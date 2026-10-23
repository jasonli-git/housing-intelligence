"""Settings every test runs under, set before anything reads them."""

import os

# A Mac with the raw archive in R2 sets HIP_ARCHIVE_REMOTE in `.env`, and the settings
# would carry it into every test: a fetch that finds a file missing would then reach
# for the real bucket. Empty here, and the environment outranks `.env`; the archive's
# own tests pass a remote explicitly (Milestone 56).
os.environ["HIP_ARCHIVE_REMOTE"] = ""
