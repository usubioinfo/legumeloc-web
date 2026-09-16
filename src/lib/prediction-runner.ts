import { execFile } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { Client, type SFTPWrapper } from 'ssh2';
import { getSSHAuthOptions, PREDICTION_CONFIG } from './config';

export type ResultValue = string | number;
export type PredictionResults = Record<string, Record<string, ResultValue>[]>;
type PredictionRequest = { jobId: string; sequence: string; level: string; model: string };
type PredictionRun = { clusterJobId?: string; executionMode: 'slurm' | 'local'; results: PredictionResults; remoteError?: string };

const shellQuote = (value: string) => `'${value.replace(/'/g, `'"'"'`)}'`;
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);
const RESULT_FILES = new Set([
  'LegumeLoc_single_vs_dual_localizations.txt',
  'LegumeLoc_single_class_localizations.txt',
  'LegumeLoc_dual_class_localizations.txt',
]);

class ClusterExecutionError extends Error {
  constructor(message: string, readonly fallbackSafe: boolean) {
    super(message);
    this.name = 'ClusterExecutionError';
  }
}

function parseTsv(content: string) {
  const lines = content.replace(/\r/g, '').split('\n').filter((line) => line.trim());
  if (!lines.length) return [];
  const headers = lines[0].split('\t');
  return lines.slice(1).map((line) => {
    const values = line.split('\t');
    return Object.fromEntries(headers.map((header, index) => {
      const raw = values[index] ?? '';
      const numeric = raw.trim() === '' ? Number.NaN : Number(raw);
      return [header, Number.isFinite(numeric) ? numeric : raw];
    }));
  });
}

async function parseLocalResults(outputDir: string): Promise<PredictionResults> {
  const files = (await fs.readdir(outputDir)).filter((file) => file.endsWith('.txt')).sort();
  if (!files.length) throw new Error('Prediction completed without producing result files.');
  const results: PredictionResults = {};
  for (const file of files) results[file] = parseTsv(await fs.readFile(path.join(outputDir, file), 'utf8'));
  return results;
}

function connectSSH() {
  return new Promise<Client>((resolve, reject) => {
    const client = new Client();
    client.once('ready', () => resolve(client));
    client.once('error', reject);
    client.connect(getSSHAuthOptions());
  });
}

function execRemote(client: Client, command: string) {
  return new Promise<string>((resolve, reject) => {
    client.exec(command, (error, stream) => {
      if (error) return reject(error);
      let stdout = '';
      let stderr = '';
      stream.on('data', (data: Buffer) => { stdout += data.toString(); });
      stream.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
      stream.on('close', (code: number | null) => code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr.trim() || `Remote command failed with exit code ${code}.`)));
    });
  });
}

function execSbatchAndWait(client: Client, command: string) {
  return new Promise<{ clusterJobId: string; stderr: string }>((resolve, reject) => {
    client.exec(command, (error, stream) => {
      if (error) return reject(new ClusterExecutionError(error.message, true));
      let stdout = '';
      let stderr = '';
      let settled = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const getJobId = () => stdout.match(/(?:^|\n)(\d+)(?:;[^\n]*)?/)?.[1] || '';
      const finishReject = (message: string, fallbackSafe: boolean) => {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        reject(new ClusterExecutionError(message, fallbackSafe));
      };
      if (PREDICTION_CONFIG.timeoutMs > 0) {
        timeout = setTimeout(() => {
          const clusterJobId = getJobId();
          stream.destroy();
          finishReject(
            clusterJobId
              ? `Timed out waiting for SLURM job ${clusterJobId}; the job may still be running, so local fallback was not started.`
              : 'Timed out after sending the SLURM submission; job state is uncertain, so local fallback was not started.',
            false,
          );
        }, PREDICTION_CONFIG.timeoutMs);
      }

      stream.on('data', (data: Buffer) => { stdout += data.toString(); });
      stream.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
      stream.on('error', (streamError: Error) => {
        const clusterJobId = getJobId();
        finishReject(
          clusterJobId
            ? `Lost the SSH command channel while waiting for SLURM job ${clusterJobId}: ${streamError.message}`
            : `Lost the SSH command channel after submission was sent: ${streamError.message}`,
          false,
        );
      });
      stream.on('close', (code: number | null) => {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        const clusterJobId = getJobId();
        if (typeof code !== 'number') {
          return reject(new ClusterExecutionError('The SSH command channel closed without a SLURM exit code; local fallback was not started.', false));
        }
        if (code !== 0) {
          return reject(new ClusterExecutionError(
            `${clusterJobId ? `SLURM job ${clusterJobId}` : 'sbatch'} failed with exit code ${code}${stderr.trim() ? `: ${stderr.trim()}` : '.'}`,
            true,
          ));
        }
        if (!clusterJobId) return reject(new ClusterExecutionError('sbatch completed but did not return a parsable job ID.', false));
        resolve({ clusterJobId, stderr: stderr.trim() });
      });
    });
  });
}

function openSftp(client: Client) {
  return new Promise<SFTPWrapper>((resolve, reject) => client.sftp((error, sftp) => error ? reject(error) : resolve(sftp)));
}

function sftpWrite(sftp: SFTPWrapper, remotePath: string, content: string) {
  return new Promise<void>((resolve, reject) => sftp.writeFile(remotePath, Buffer.from(content), (error) => error ? reject(error) : resolve()));
}

function sftpChmod(sftp: SFTPWrapper, remotePath: string, mode: number) {
  return new Promise<void>((resolve, reject) => sftp.chmod(remotePath, mode, (error) => error ? reject(error) : resolve()));
}

function sftpRead(sftp: SFTPWrapper, remotePath: string) {
  return new Promise<string>((resolve, reject) => sftp.readFile(remotePath, (error, data) => error ? reject(error) : resolve(data.toString())));
}

function sftpList(sftp: SFTPWrapper, remotePath: string) {
  return new Promise<string[]>((resolve, reject) => sftp.readdir(remotePath, (error, entries) => error ? reject(error) : resolve(entries.map((entry) => entry.filename))));
}

async function collectRemoteResults(sftp: SFTPWrapper, outputDir: string): Promise<PredictionResults> {
  const files = (await sftpList(sftp, outputDir)).filter((file) => RESULT_FILES.has(file)).sort();
  if (!files.length) throw new Error('SLURM job completed without producing result files.');
  const results: PredictionResults = {};
  for (const file of files) results[file] = parseTsv(await sftpRead(sftp, `${outputDir}/${file}`));
  return results;
}

async function runOnCluster(request: PredictionRequest): Promise<PredictionRun> {
  const client = await connectSSH();
  let sftp: SFTPWrapper | undefined;
  try {
    const remoteRoot = PREDICTION_CONFIG.cluster.remoteTmpDir.replace(/\/$/, '');
    const remoteInput = `${remoteRoot}/${request.jobId}.fasta`;
    const remoteOutput = `${remoteRoot}/${request.jobId}`;
    await execRemote(client, `umask 077; mkdir -p -- ${shellQuote(remoteOutput)}; chmod 700 -- ${shellQuote(remoteOutput)}`);
    sftp = await openSftp(client);
    await sftpWrite(sftp, remoteInput, request.sequence.trim());
    await sftpChmod(sftp, remoteInput, 0o600);

    const { clusterJobId } = await execSbatchAndWait(client, [
      'umask 077; sbatch --parsable --wait', `--chdir=${shellQuote(remoteOutput)}`,
      `--output=${shellQuote(`${remoteOutput}/slurm-%j.out`)}`,
      `--error=${shellQuote(`${remoteOutput}/slurm-%j.err`)}`,
      shellQuote(PREDICTION_CONFIG.cluster.remoteScript), shellQuote(remoteInput),
      shellQuote(request.level), shellQuote(request.model), shellQuote(remoteOutput),
    ].join(' '));
    try {
      const results = await collectRemoteResults(sftp, remoteOutput);
      await execRemote(client, `rm -rf -- ${shellQuote(remoteInput)} ${shellQuote(remoteOutput)}`).catch((cleanupError) => {
        console.warn(`SLURM job ${clusterJobId} succeeded, but remote cleanup failed: ${errorMessage(cleanupError)}`);
      });
      return { clusterJobId, executionMode: 'slurm', results };
    } catch (error: unknown) {
      throw new ClusterExecutionError(`SLURM job ${clusterJobId} completed but its results could not be retrieved: ${errorMessage(error)}`, false);
    }
  } finally {
    sftp?.end();
    client.end();
  }
}

async function runLocal(request: PredictionRequest, remoteError: string): Promise<PredictionRun> {
  const { pythonBin, cliPath, kerasHome } = PREDICTION_CONFIG.local;
  await Promise.all([fs.access(pythonBin), fs.access(cliPath)]).catch(() => {
    throw new Error(`Local fallback is enabled but ${pythonBin} or ${cliPath} is not readable.`);
  });
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'legumeloc-'));
  const inputPath = path.join(workDir, 'input.fasta');
  const outputDir = path.join(workDir, 'output');
  try {
    await fs.mkdir(outputDir);
    await fs.writeFile(inputPath, request.sequence.trim(), 'utf8');
    await new Promise<void>((resolve, reject) => {
      execFile(pythonBin, [cliPath, '-i', inputPath, '-o', outputDir, '-l', request.level, '-m', request.model], {
        cwd: path.dirname(cliPath), timeout: PREDICTION_CONFIG.timeoutMs, maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env, KERAS_HOME: kerasHome, TF_CPP_MIN_LOG_LEVEL: '3' },
      }, (error, _stdout, stderr) => error ? reject(new Error(stderr || error.message)) : resolve());
    });
    return { executionMode: 'local', results: await parseLocalResults(outputDir), remoteError };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

export async function executePrediction(request: PredictionRequest): Promise<PredictionRun> {
  try {
    return await runOnCluster(request);
  } catch (remoteFailure: unknown) {
    const remoteError = errorMessage(remoteFailure).replace(/[.\s]+$/, '');
    if (remoteFailure instanceof ClusterExecutionError && !remoteFailure.fallbackSafe) throw remoteFailure;
    if (!PREDICTION_CONFIG.local.enabled) throw new Error(`SLURM execution failed: ${remoteError}. Local fallback is disabled.`);
    try {
      return await runLocal(request, remoteError);
    } catch (localFailure: unknown) {
      throw new Error(`SLURM execution failed: ${remoteError}. Local fallback also failed: ${errorMessage(localFailure).replace(/[.\s]+$/, '')}.`);
    }
  }
}
