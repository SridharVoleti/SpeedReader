@echo off
rem Windows launcher: pipeline.cmd <command> [options]   (requires node >= 22.13 on PATH)
node "%~dp0pipeline.mjs" %*
