# LegumeLoc web application

LegumeLoc is a Next.js web interface for predicting legume crop protein subcellular localization. It supports FASTA input, accession-based sequence retrieval, three selectable prediction levels, Fast and Sensitive models, protected asynchronous jobs, and results export.

Prediction computation is not included in this repository. In production, the application sends validated inputs over pinned-key SSH/SFTP to a configured SLURM cluster and runs the configured batch script with `sbatch --wait`. It never fabricates prediction results.

## Local interface development

```bash
npm ci
npm run dev
```

The interface is available at `http://localhost:3000`. Cluster-backed prediction endpoints require the environment described in `deploy/README.md`.

## Production build

```bash
npm ci
npm run build
npm start
```

The included Dockerfile creates a non-root Next.js standalone image. Prediction inputs, downloadable archives, SSH keys, and environment files are intentionally excluded from version control and the Docker build context.

## License

No open-source license has been assigned yet. The source is publicly visible, but reuse rights remain reserved unless a license is added.
