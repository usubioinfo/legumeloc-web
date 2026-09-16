#!/usr/bin/env bash
# LegumeLoc web deployment manager.
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="${SCRIPT_DIR}/deploy"
ENV_FILE="${DEPLOY_DIR}/docker.env"
ENV_EXAMPLE="${DEPLOY_DIR}/docker.env.example"
ACTION="menu"

usage() {
    cat <<'EOF'
Usage: ./start.sh [MODE]

Without a mode, an interactive deployment menu is shown.

  --setup           Create/update deploy/docker.env, build, and start.
  --configure-only  Create/update and validate docker.env without starting.
  --start-only      Start existing images without pulling or rebuilding.
  --update          Pull the Git repository, rebuild changed images, and start.
  --rebuild         Recreate this project and build fresh images without cache.
  -h, --help        Show this help message.

Set CONTAINER_ENGINE=docker or CONTAINER_ENGINE=podman to override detection.
EOF
}

set_action() {
    if [[ "${ACTION}" != menu ]]; then
        printf 'Choose only one deployment mode.\n' >&2
        exit 2
    fi
    ACTION="$1"
}

for argument in "$@"; do
    case "${argument}" in
        --setup) set_action setup ;;
        --configure-only) set_action configure ;;
        --start-only) set_action start ;;
        --update) set_action update ;;
        --rebuild) set_action rebuild ;;
        -h|--help) usage; exit 0 ;;
        *) printf 'Unknown option: %s\n' "${argument}" >&2; usage >&2; exit 2 ;;
    esac
done

if [[ ! -t 0 && ( "${ACTION}" == menu || "${ACTION}" == setup || "${ACTION}" == configure ) ]]; then
    printf 'Configuration modes are interactive and require a terminal.\n' >&2
    exit 1
fi

if [[ ! -f "${ENV_EXAMPLE}" ]]; then
    printf 'Missing configuration template: %s\n' "${ENV_EXAMPLE}" >&2
    exit 1
fi

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

current_value() {
    local key="$1"
    local source_file="${ENV_FILE}"
    [[ -f "${source_file}" ]] || source_file="${ENV_EXAMPLE}"
    awk -v wanted="${key}" '
        index($0, wanted "=") == 1 {
            sub(/^[^=]*=/, "")
            print
            exit
        }
    ' "${source_file}"
}

prompt_value() {
    local key="$1" label="$2" fallback="${3:-}" required="${4:-true}"
    local value default_value
    default_value="$(current_value "${key}")"
    if [[ -z "${default_value}" || "${default_value}" == *replace-with* || "${default_value}" == *example.edu* || "${default_value}" == /absolute/path/* || "${default_value}" == /home/cluster-service-user/* ]]; then
        default_value="${fallback}"
    fi
    while true; do
        if [[ -n "${default_value}" ]]; then
            read -r -p "${label} [${default_value}]: " value
            value="${value:-${default_value}}"
        else
            read -r -p "${label}: " value
        fi
        if [[ "${required}" == true && -z "${value}" ]]; then
            printf 'A value is required.\n' >&2
            continue
        fi
        if [[ "${value}" == *$'\n'* || "${value}" == *$'\r'* ]]; then
            printf 'Line breaks are not allowed.\n' >&2
            continue
        fi
        printf -v "${key}" '%s' "${value}"
        return
    done
}

prompt_secret() {
    local key="$1" label="$2" required="${3:-true}"
    local existing value
    existing="$(current_value "${key}")"
    [[ "${existing}" == *replace-with* ]] && existing=""
    while true; do
        if [[ -n "${existing}" ]]; then
            read -r -s -p "${label} [press Enter to keep existing]: " value
            printf '\n'
            value="${value:-${existing}}"
        else
            read -r -s -p "${label}: " value
            printf '\n'
        fi
        if [[ "${required}" == true && -z "${value}" ]]; then
            printf 'A value is required.\n' >&2
            continue
        fi
        printf -v "${key}" '%s' "${value}"
        return
    done
}

prompt_yes_no() {
    local label="$1" default_answer="$2" answer suffix
    [[ "${default_answer}" == true ]] && suffix='Y/n' || suffix='y/N'
    while true; do
        read -r -p "${label} [${suffix}]: " answer
        answer="${answer:-$([[ "${default_answer}" == true ]] && printf y || printf n)}"
        case "${answer}" in
            y|Y|yes|YES) return 0 ;;
            n|N|no|NO) return 1 ;;
            *) printf 'Please answer yes or no.\n' >&2 ;;
        esac
    done
}

select_engine() {
    local default_engine="" selected="" rootless
    if command_exists podman && podman compose version >/dev/null 2>&1; then
        default_engine="podman"
    elif command_exists docker && docker compose version >/dev/null 2>&1; then
        default_engine="docker"
    else
        printf 'Docker Compose or Podman Compose is required.\n' >&2
        exit 1
    fi

    selected="${CONTAINER_ENGINE:-}"
    if [[ -z "${selected}" && ( "${ACTION}" == setup || "${ACTION}" == configure ) ]]; then
        read -r -p "Container engine [${default_engine}]: " selected
    fi
    ENGINE="${selected:-${default_engine}}"
    if [[ "${ENGINE}" != docker && "${ENGINE}" != podman ]]; then
        printf 'Container engine must be docker or podman.\n' >&2
        exit 1
    fi
    if ! command_exists "${ENGINE}" || ! "${ENGINE}" compose version >/dev/null 2>&1; then
        printf '%s Compose is not available.\n' "${ENGINE}" >&2
        exit 1
    fi
    if [[ "${ENGINE}" == podman ]]; then
        rootless="$(podman info --format '{{.Host.Security.Rootless}}' 2>/dev/null || true)"
        if [[ "${rootless}" != true ]]; then
            printf 'Podman must run rootlessly for this deployment.\n' >&2
            exit 1
        fi
        COMPOSE_FILES=(-f deploy/compose.yaml -f deploy/compose.podman.yaml)
    else
        COMPOSE_FILES=(-f deploy/compose.yaml -f deploy/compose.ssh-key.yaml)
    fi
}

select_action() {
    local choice
    cat <<'EOF'
Choose an action:
  1) First-time setup or edit configuration, then build and start
  2) Start only (no pull and no build)
  3) Update from Git, rebuild changed images, and start
  4) Clean rebuild (replace containers and rebuild images without cache)
  5) Configure only (do not start)
EOF
    while true; do
        read -r -p 'Action [1]: ' choice
        case "${choice:-1}" in
            1) ACTION=setup; return ;;
            2) ACTION=start; return ;;
            3) ACTION=update; return ;;
            4) ACTION=rebuild; return ;;
            5) ACTION=configure; return ;;
            *) printf 'Choose 1, 2, 3, 4, or 5.\n' >&2 ;;
        esac
    done
}

check_health() {
    local bind_address base_path health_host health_url attempt
    bind_address="$(current_value PUBLIC_BIND_ADDRESS)"
    base_path="$(current_value NEXT_PUBLIC_BASE_PATH)"
    bind_address="${bind_address:-127.0.0.1}"
    base_path="${base_path:-/LegumeLoc}"
    health_host="${bind_address}"
    [[ "${health_host}" == 0.0.0.0 || "${health_host}" == :: ]] && health_host=127.0.0.1
    health_url="http://${health_host}:3220${base_path}"
    printf 'Waiting for %s ...\n' "${health_url}"
    for attempt in {1..30}; do
        if curl --fail --silent --show-error --max-time 5 "${health_url}" >/dev/null 2>&1; then
            printf 'LegumeLoc is ready at %s\n' "${health_url}"
            return 0
        fi
        sleep 2
    done
    printf 'Containers started, but the health check did not pass within 60 seconds.\n' >&2
    printf 'Inspect logs with: %s compose --env-file deploy/docker.env %s logs app gateway\n' "${ENGINE}" "${COMPOSE_FILES[*]}" >&2
    return 1
}

build_podman_app() {
    local cache_mode="${1:-cached}"
    local build_args=(
        build
        --jobs=1
        --pull
        --build-arg "NEXT_PUBLIC_BASE_PATH=$(current_value NEXT_PUBLIC_BASE_PATH)"
        --build-arg "NEXT_PUBLIC_TURNSTILE_SITE_KEY=$(current_value TURNSTILE_SITE_KEY)"
        --tag legumeloc-web:1.0
    )
    [[ "${cache_mode}" == no-cache ]] && build_args+=(--no-cache)
    build_args+=(.)
    printf 'Building the LegumeLoc application with one Podman stage at a time...\n'
    podman "${build_args[@]}"
}

run_existing_deployment() {
    if [[ ! -f "${ENV_FILE}" ]]; then
        printf 'Missing %s. Run ./start.sh --setup first.\n' "${ENV_FILE}" >&2
        exit 1
    fi
    cd "${SCRIPT_DIR}"
    "${ENGINE}" compose --env-file deploy/docker.env "${COMPOSE_FILES[@]}" config >/dev/null

    case "${ACTION}" in
        start)
            printf 'Starting existing LegumeLoc containers without pulling or rebuilding...\n'
            "${ENGINE}" compose --env-file deploy/docker.env "${COMPOSE_FILES[@]}" up -d --no-build
            ;;
        update)
            if [[ ! -d "${SCRIPT_DIR}/.git" ]]; then
                printf 'Update mode requires a Git checkout.\n' >&2
                exit 1
            fi
            printf 'Updating the repository with a fast-forward-only pull...\n'
            git -C "${SCRIPT_DIR}" pull --ff-only
            "${ENGINE}" compose --env-file deploy/docker.env "${COMPOSE_FILES[@]}" config >/dev/null
            if [[ "${ENGINE}" == podman ]]; then
                build_podman_app
                "${ENGINE}" compose --env-file deploy/docker.env "${COMPOSE_FILES[@]}" up -d --no-build --force-recreate --remove-orphans
            else
                "${ENGINE}" compose --env-file deploy/docker.env "${COMPOSE_FILES[@]}" up -d --build --remove-orphans
            fi
            ;;
        rebuild)
            printf 'Replacing this Compose project and rebuilding images without cache. Job data and downloads are preserved.\n'
            "${ENGINE}" compose --env-file deploy/docker.env "${COMPOSE_FILES[@]}" down --remove-orphans
            if [[ "${ENGINE}" == podman ]]; then
                build_podman_app no-cache
            else
                "${ENGINE}" compose --env-file deploy/docker.env "${COMPOSE_FILES[@]}" build --pull --no-cache
            fi
            "${ENGINE}" compose --env-file deploy/docker.env "${COMPOSE_FILES[@]}" up -d
            ;;
    esac

    "${ENGINE}" compose --env-file deploy/docker.env "${COMPOSE_FILES[@]}" ps
    check_health
}

write_setting() {
    printf '%s=%s\n' "$1" "$2" >>"${TEMP_ENV_FILE}"
}

validate_integer() {
    local key="$1" value="$2"
    if [[ ! "${value}" =~ ^[0-9]+$ ]]; then
        printf '%s must be a non-negative integer.\n' "${key}" >&2
        exit 1
    fi
}

printf '\nLegumeLoc web deployment manager\n'
printf 'Secrets are written only to deploy/docker.env with mode 0600.\n\n'

[[ "${ACTION}" == menu ]] && select_action
select_engine

if [[ "${ACTION}" == start || "${ACTION}" == update || "${ACTION}" == rebuild ]]; then
    run_existing_deployment
    exit 0
fi

prompt_value BIOCLUSTER_HOST 'HPC login host'
prompt_value BIOCLUSTER_PORT 'HPC SSH port' '22'
prompt_value BIOCLUSTER_USER 'Dedicated HPC service account'
prompt_value BIOCLUSTER_HOST_KEY_SHA256 'Verified HPC ED25519 SHA-256 fingerprint'
prompt_value BIOCLUSTER_KEY_FILE 'Absolute path to the dedicated HPC private key'
prompt_value BIOCLUSTER_REMOTE_SCRIPT 'Absolute HPC path to the LegumeLoc SLURM script'
prompt_value BIOCLUSTER_REMOTE_TMP_DIR 'Absolute HPC prediction-jobs directory'

prompt_secret TURNSTILE_SITE_KEY 'Cloudflare Turnstile site key'
prompt_secret TURNSTILE_SECRET_KEY 'Cloudflare Turnstile secret key'

existing_hmac="$(current_value JOB_OWNER_HMAC_SECRET)"
if [[ -z "${existing_hmac}" || "${existing_hmac}" == *replace-with* ]]; then
    if command_exists openssl; then
        JOB_OWNER_HMAC_SECRET="$(openssl rand -hex 32)"
    else
        JOB_OWNER_HMAC_SECRET="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
    fi
    printf 'Generated a new private job-ownership secret.\n'
else
    JOB_OWNER_HMAC_SECRET="${existing_hmac}"
    printf 'Keeping the existing private job-ownership secret.\n'
fi

default_uid="$(id -u)"
default_gid="$(id -g)"
prompt_value DOCKER_UID 'Container user ID' "${default_uid}"
prompt_value DOCKER_GID 'Container group ID' "${default_gid}"
prompt_value PUBLIC_BIND_ADDRESS 'Gateway bind address' '127.0.0.1'
prompt_value TRUSTED_PROXY_CIDR 'Trusted reverse-proxy address/CIDR' '127.0.0.1/32'
prompt_value NEXT_PUBLIC_BASE_PATH 'Public URL base path' '/LegumeLoc'

PREDICTION_TIMEOUT_MS="$(current_value PREDICTION_TIMEOUT_MS)"; PREDICTION_TIMEOUT_MS="${PREDICTION_TIMEOUT_MS:-0}"
PREDICTION_JOB_RETENTION_MS="$(current_value PREDICTION_JOB_RETENTION_MS)"; PREDICTION_JOB_RETENTION_MS="${PREDICTION_JOB_RETENTION_MS:-2592000000}"
PREDICTION_MAX_ACTIVE_JOBS="$(current_value PREDICTION_MAX_ACTIVE_JOBS)"; PREDICTION_MAX_ACTIVE_JOBS="${PREDICTION_MAX_ACTIVE_JOBS:-10}"
PREDICTION_MAX_ACTIVE_JOBS_PER_CLIENT="$(current_value PREDICTION_MAX_ACTIVE_JOBS_PER_CLIENT)"; PREDICTION_MAX_ACTIVE_JOBS_PER_CLIENT="${PREDICTION_MAX_ACTIVE_JOBS_PER_CLIENT:-2}"
MAX_REQUEST_BODY_BYTES="$(current_value MAX_REQUEST_BODY_BYTES)"; MAX_REQUEST_BODY_BYTES="${MAX_REQUEST_BODY_BYTES:-1048576}"
PREDICTION_MAX_SEQUENCES="$(current_value PREDICTION_MAX_SEQUENCES)"; PREDICTION_MAX_SEQUENCES="${PREDICTION_MAX_SEQUENCES:-10000}"
PREDICTION_MAX_RESIDUES="$(current_value PREDICTION_MAX_RESIDUES)"; PREDICTION_MAX_RESIDUES="${PREDICTION_MAX_RESIDUES:-1000000}"
PREDICTION_MAX_SEQUENCE_LENGTH="$(current_value PREDICTION_MAX_SEQUENCE_LENGTH)"; PREDICTION_MAX_SEQUENCE_LENGTH="${PREDICTION_MAX_SEQUENCE_LENGTH:-20000}"
MAX_ACCESSION_COUNT="$(current_value MAX_ACCESSION_COUNT)"; MAX_ACCESSION_COUNT="${MAX_ACCESSION_COUNT:-50}"
MAX_ACCESSION_LENGTH="$(current_value MAX_ACCESSION_LENGTH)"; MAX_ACCESSION_LENGTH="${MAX_ACCESSION_LENGTH:-64}"

if prompt_yes_no 'Configure advanced limits now?' false; then
    prompt_value PREDICTION_TIMEOUT_MS 'Prediction timeout in milliseconds (0 disables timeout)' "${PREDICTION_TIMEOUT_MS}"
    prompt_value PREDICTION_JOB_RETENTION_MS 'Private-result retention in milliseconds' "${PREDICTION_JOB_RETENTION_MS}"
    prompt_value PREDICTION_MAX_ACTIVE_JOBS 'Maximum active jobs' "${PREDICTION_MAX_ACTIVE_JOBS}"
    prompt_value PREDICTION_MAX_ACTIVE_JOBS_PER_CLIENT 'Maximum active jobs per client' "${PREDICTION_MAX_ACTIVE_JOBS_PER_CLIENT}"
    prompt_value MAX_REQUEST_BODY_BYTES 'Maximum request body in bytes' "${MAX_REQUEST_BODY_BYTES}"
    prompt_value PREDICTION_MAX_SEQUENCES 'Maximum sequences per request' "${PREDICTION_MAX_SEQUENCES}"
    prompt_value PREDICTION_MAX_RESIDUES 'Maximum total residues per request' "${PREDICTION_MAX_RESIDUES}"
    prompt_value PREDICTION_MAX_SEQUENCE_LENGTH 'Maximum residues per sequence' "${PREDICTION_MAX_SEQUENCE_LENGTH}"
    prompt_value MAX_ACCESSION_COUNT 'Maximum accessions per request' "${MAX_ACCESSION_COUNT}"
    prompt_value MAX_ACCESSION_LENGTH 'Maximum accession length' "${MAX_ACCESSION_LENGTH}"
fi

validate_integer BIOCLUSTER_PORT "${BIOCLUSTER_PORT}"
for key in DOCKER_UID DOCKER_GID PREDICTION_TIMEOUT_MS PREDICTION_JOB_RETENTION_MS PREDICTION_MAX_ACTIVE_JOBS PREDICTION_MAX_ACTIVE_JOBS_PER_CLIENT MAX_REQUEST_BODY_BYTES PREDICTION_MAX_SEQUENCES PREDICTION_MAX_RESIDUES PREDICTION_MAX_SEQUENCE_LENGTH MAX_ACCESSION_COUNT MAX_ACCESSION_LENGTH; do
    validate_integer "${key}" "${!key}"
done

if [[ ! "${BIOCLUSTER_HOST_KEY_SHA256}" =~ ^SHA256:[A-Za-z0-9+/]{43}=?$ ]]; then
    printf 'BIOCLUSTER_HOST_KEY_SHA256 is not a valid SHA256 fingerprint.\n' >&2
    exit 1
fi
if [[ "${BIOCLUSTER_KEY_FILE}" != /* || ! -f "${BIOCLUSTER_KEY_FILE}" ]]; then
    printf 'The HPC private key must be an existing absolute file path.\n' >&2
    exit 1
fi
key_mode="$(stat -c '%a' "${BIOCLUSTER_KEY_FILE}" 2>/dev/null || stat -f '%Lp' "${BIOCLUSTER_KEY_FILE}")"
if (( 8#${key_mode} & 8#077 )); then
    printf 'The HPC private key is accessible by group or other users (mode %s). Run chmod 600 on it first.\n' "${key_mode}" >&2
    exit 1
fi
if [[ "${BIOCLUSTER_REMOTE_SCRIPT}" != /* || "${BIOCLUSTER_REMOTE_TMP_DIR}" != /* ]]; then
    printf 'Remote script and prediction-jobs directory must be absolute HPC paths.\n' >&2
    exit 1
fi
if [[ "${NEXT_PUBLIC_BASE_PATH}" != /* || "${NEXT_PUBLIC_BASE_PATH}" == */ ]]; then
    printf 'The public base path must begin with / and must not end with /.\n' >&2
    exit 1
fi
if [[ ${#JOB_OWNER_HMAC_SECRET} -lt 64 ]]; then
    printf 'JOB_OWNER_HMAC_SECRET must contain at least 64 characters.\n' >&2
    exit 1
fi

mkdir -p "${SCRIPT_DIR}/public/download" "${DEPLOY_DIR}/data/jobs"
TEMP_ENV_FILE="$(mktemp "${DEPLOY_DIR}/.docker.env.XXXXXX")"
trap 'rm -f "${TEMP_ENV_FILE:-}"' EXIT
chmod 0600 "${TEMP_ENV_FILE}"

for key in BIOCLUSTER_HOST BIOCLUSTER_PORT BIOCLUSTER_USER BIOCLUSTER_HOST_KEY_SHA256 BIOCLUSTER_KEY_FILE BIOCLUSTER_REMOTE_SCRIPT BIOCLUSTER_REMOTE_TMP_DIR TURNSTILE_SITE_KEY TURNSTILE_SECRET_KEY JOB_OWNER_HMAC_SECRET DOCKER_UID DOCKER_GID PUBLIC_BIND_ADDRESS TRUSTED_PROXY_CIDR NEXT_PUBLIC_BASE_PATH PREDICTION_TIMEOUT_MS PREDICTION_JOB_RETENTION_MS PREDICTION_MAX_ACTIVE_JOBS PREDICTION_MAX_ACTIVE_JOBS_PER_CLIENT MAX_REQUEST_BODY_BYTES PREDICTION_MAX_SEQUENCES PREDICTION_MAX_RESIDUES PREDICTION_MAX_SEQUENCE_LENGTH MAX_ACCESSION_COUNT MAX_ACCESSION_LENGTH; do
    write_setting "${key}" "${!key}"
done
write_setting TURNSTILE_REQUIRED true

mv -f "${TEMP_ENV_FILE}" "${ENV_FILE}"
trap - EXIT
chmod 0600 "${ENV_FILE}"
printf '\nWrote %s with mode 0600.\n' "${ENV_FILE}"

cd "${SCRIPT_DIR}"
"${ENGINE}" compose --env-file deploy/docker.env "${COMPOSE_FILES[@]}" config >/dev/null
printf 'Compose configuration is valid.\n'

if [[ "${ACTION}" == configure ]]; then
    printf 'Configuration complete; containers were not started.\n'
    exit 0
fi

if [[ "${ENGINE}" == podman ]]; then
    build_podman_app
    "${ENGINE}" compose --env-file deploy/docker.env "${COMPOSE_FILES[@]}" up -d --no-build
else
    "${ENGINE}" compose --env-file deploy/docker.env "${COMPOSE_FILES[@]}" up -d --build
fi
"${ENGINE}" compose --env-file deploy/docker.env "${COMPOSE_FILES[@]}" ps
check_health
