# Publishing Limix Bot

Desktop installers are distributed through [Limix Bot releases](https://github.com/leomieo/limix-bot/releases). The desktop updater reads the Windows, macOS and Linux feeds attached to the release.

## Desktop

Use the [Limix Bot Desktop workflow](https://github.com/leomieo/limix-bot/blob/main/.github/workflows/limix-desktop.yml) on the release commit. A manual run can build and verify the packages before publishing. Select the publish option when the version is ready for distribution. Verify the release tag and download each installer using the published updater feed. Compare its size and SHA-512 checksum with the feed.

## Self-hosted server

The [Docker workflow](https://github.com/leomieo/limix-bot/blob/main/.github/workflows/limix-docker.yml) publishes the server image to `ghcr.io/leomieo/limix-bot`. Pull the versioned image and confirm its digest and server version. The [npm workflow](https://github.com/leomieo/limix-bot/blob/main/.github/workflows/limix-npm.yml) publishes the `limixbot` CLI. See the [self-hosting guide](self-hosting.md) for a pinned installation and a verification procedure.
