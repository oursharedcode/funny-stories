# README assets

Image and GIF assets embedded in the root [README](../README.md).

## `secret-powershell.gif` — **needs to be recorded**

A short screen capture demonstrating secret generation in Windows PowerShell. It is referenced by the README but the actual file is not yet committed.

**What to record:**

1. Open Windows PowerShell.
2. Paste and run:
   ```powershell
   [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
   ```
3. Show the 64-character output and selecting/copying it.

**Suggested capture settings:** ~6–10 seconds, 800–1000 px wide, optimized GIF (keep it under ~2 MB so the README loads fast). Tools: ScreenToGif (Windows, free), or record an MP4 and convert with `ffmpeg`.

Save the file here as `secret-powershell.gif`.
