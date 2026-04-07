#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SOURCE_DIR="${REPO_ROOT}/.opencode/skills"
TARGET_DIR="${REPO_ROOT}/.agents/skills"

if [ ! -d "${SOURCE_DIR}" ]; then
  echo "Source skill directory not found: ${SOURCE_DIR}"
  exit 1
fi

mkdir -p "${TARGET_DIR}"

copied=0
updated=0

for skill_dir in "${SOURCE_DIR}"/*; do
  [ -d "${skill_dir}" ] || continue
  [ -f "${skill_dir}/SKILL.md" ] || continue

  skill_name="$(basename "${skill_dir}")"
  target_skill_dir="${TARGET_DIR}/${skill_name}"

  if [ -d "${target_skill_dir}" ]; then
    cp -a "${skill_dir}/." "${target_skill_dir}/"
    updated=$((updated + 1))
    echo "Updated skill: ${skill_name}"
  else
    mkdir -p "${target_skill_dir}"
    cp -a "${skill_dir}/." "${target_skill_dir}/"
    copied=$((copied + 1))
    echo "Loaded skill: ${skill_name}"
  fi
done

echo "Skill load complete. copied=${copied} updated=${updated}"
