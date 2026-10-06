# LegumeLoc VM deployment

This deployment runs the Next.js application behind an unprivileged Nginx gateway on VM port 3220. Prediction inputs are transferred over pinned-key SSH/SFTP to the configured cluster, submitted with `sbatch --parsable --wait`, and the real result files are retrieved over SFTP.

## VM preparation

Install Docker Engine and its Compose plugin, then clone this repository. Create the runtime-only directories and environment file:

```bash
mkdir -p public/download deploy/data/jobs
cp deploy/docker.env.example deploy/docker.env
openssl rand -hex 32
```

Put the generated value in `JOB_OWNER_HMAC_SECRET`. Fill in the remaining placeholders in `deploy/docker.env`. The environment file and job data are ignored by Git.

Use a dedicated, restricted cluster SSH key. Verify the cluster ED25519 fingerprint with the cluster administrator through a separate trusted channel before setting `BIOCLUSTER_HOST_KEY_SHA256`:

```bash
ssh-keyscan -p 22 -t ed25519 biocluster.example.edu | ssh-keygen -lf - -E sha256
chmod 0600 /absolute/path/to/dedicated-private-key
```

`ssh-keyscan` discovers a key but does not establish trust by itself. Password authentication is not supported by this deployment.

The configured SLURM script must accept `input.fasta level model output-directory`, write final tab-delimited results under the supplied output directory, and return a nonzero exit code on failure.

Keep the installed application and runtime job directories separate. Replace these example paths with the private paths configured on your cluster:

```dotenv
BIOCLUSTER_REMOTE_SCRIPT=/absolute/path/to/LegumeLoc/legumeloc.sl
BIOCLUSTER_REMOTE_TMP_DIR=/absolute/path/to/prediction-jobs/legumeloc
```

The application transfers each validated FASTA to the prediction-jobs directory over SFTP (the SSH file-transfer protocol used here in place of a separate `scp` process), submits the configured SLURM script, retrieves the result files over SFTP, and removes the remote per-job files after successful retrieval.

## Start

The recommended interactive setup from the repository root is:

```bash
./start.sh
```

The launcher creates `deploy/docker.env` with mode `0600`, validates the selected Compose configuration, builds the application, starts the services, and checks the site at `/legumeloc`. Later runs can start existing images, pull Git updates and rebuild, or perform a clean rebuild while preserving job data and downloads. The equivalent direct modes are `--start-only`, `--update`, and `--rebuild`. To create and validate the environment file without starting containers, run `./start.sh --configure-only`.

### Rootless Podman (recommended on RHEL-family VMs)

Install the external Compose provider, then run the deployment as the unprivileged VM user without `sudo`:

```bash
sudo dnf install -y podman-compose
podman info --format '{{.Host.Security.Rootless}}'
podman compose --env-file deploy/docker.env \
  -f deploy/compose.yaml \
  -f deploy/compose.podman.yaml \
  up -d --build
```

The rootless check must print `true`. The Podman overlay uses `keep-id` for the application process and private SELinux relabeling for its bind mounts. It also mounts the dedicated cluster key read-only; do not add `compose.ssh-key.yaml` to the Podman command.

### Docker Engine

```bash
docker compose --env-file deploy/docker.env -f deploy/compose.yaml -f deploy/compose.ssh-key.yaml up -d --build
```

The gateway listens only on `127.0.0.1:3220` by default. When the HTTPS reverse proxy is on another host, set `PUBLIC_BIND_ADDRESS` to the VM's private interface and `TRUSTED_PROXY_CIDR` to the reverse proxy's exact source address with a `/32` prefix. Restrict TCP port 3220 at the VM firewall to that same source address. Never expose the internal application container.

For a subpath deployment, set `NEXT_PUBLIC_BASE_PATH=/legumeloc` before building and proxy the path without stripping it:

```apache
ProxyPreserveHost On
ProxyAddHeaders On
RequestHeader set X-Forwarded-Proto "https"
ProxyPass        "/legumeloc" "http://VM_PRIVATE_IP:3220/legumeloc"
ProxyPassReverse "/legumeloc" "http://VM_PRIVATE_IP:3220/legumeloc"
```

Check the deployment:

```bash
podman compose --env-file deploy/docker.env -f deploy/compose.yaml -f deploy/compose.podman.yaml ps
podman compose --env-file deploy/docker.env -f deploy/compose.yaml -f deploy/compose.podman.yaml logs -f app gateway
curl --fail http://127.0.0.1:3220/legumeloc
```

## Results retention

Private results are retained for 30 days by default (`PREDICTION_JOB_RETENTION_MS=2592000000`). Install the included cleanup command in the rootless Podman user's crontab, replacing `/absolute/path/to/LegumeLoc-web` with the cloned repository path:

```cron
43 3 * * * /absolute/path/to/LegumeLoc-web/deploy/prune-expired-jobs.sh
```

Run `crontab -e` as the same unprivileged user that owns `deploy/data/jobs`; do not install this in root's crontab. The application also prunes expired directories when accepting a new job.

Place `LegumeLoc.tar.gz` in `public/download/` only if the public package-download link should be enabled. The archive is mounted at runtime and is never stored in Git or baked into the image.

For a large archive, create the destination on the VM first and transfer it with resumable `rsync` (replace the placeholders with the VM login and checkout path):

```bash
# On the VM
mkdir -p /absolute/path/to/LegumeLoc-web/public/download

# On the computer that currently has the archive
rsync --archive --partial --info=progress2 \
  /path/to/LegumeLoc.tar.gz \
  VM_USER@VM_HOST:/absolute/path/to/LegumeLoc-web/public/download/LegumeLoc.tar.gz

# Back on the VM
chmod 0644 /absolute/path/to/LegumeLoc-web/public/download/LegumeLoc.tar.gz
cd /absolute/path/to/LegumeLoc-web
./start.sh --start-only
docker compose --env-file deploy/docker.env -f deploy/compose.yaml \
  -f deploy/compose.ssh-key.yaml restart gateway
docker compose --env-file deploy/docker.env -f deploy/compose.yaml \
  -f deploy/compose.ssh-key.yaml exec -T app \
  test -r /app/public/download/LegumeLoc.tar.gz
curl --fail --head http://127.0.0.1:3220/legumeloc/download/LegumeLoc.tar.gz
```

For rootless Podman, replace the `docker compose` commands with `podman compose` and use `-f deploy/compose.podman.yaml` instead of `-f deploy/compose.ssh-key.yaml`.

## Optional local fallback

Cluster execution is always attempted first. Local inference remains disabled unless `deploy/compose.local-fallback.yaml` is added explicitly and `LOCAL_PREDICTOR_DIR` points to a read-only predictor installation containing `.venv/bin/python`, `LegumeLoc.py`, packages, and models.

Do not use the fallback overlay on a resource-constrained VM until its CPU and memory limits have been reviewed.
