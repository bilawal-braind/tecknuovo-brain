# ---------------------------------------------------------------------------
# n8n image for Azure Container Apps — Tecknuovo Second Brain
#
# This is a THIN wrapper over n8n's official image. We don't change n8n itself.
# Reasons to have our own image rather than pulling the public one directly:
#   1. Pin the exact version so the hosted container matches what we tested.
#   2. Push it to Azure Container Registry (ACR) so it lives in TN's tenant.
#
# ALL real configuration (database, encryption key, public URL) is supplied as
# environment variables at deploy time — see README.md. Do NOT bake secrets here.
# ---------------------------------------------------------------------------

# Pinned to the version currently running on the VM so behaviour is identical.
# Bump this deliberately when you want to upgrade.
FROM docker.n8n.io/n8nio/n8n:2.26.5

# n8n listens on 5678 — Azure Container Apps ingress should target this port.
EXPOSE 5678

# (Official image's user 'node', entrypoint and command are left as-is.)
# To add community nodes or OS packages later:
#   USER root
#   RUN npm install -g n8n-nodes-xxx   (or apk add ...)
#   USER node
# Not needed today.
