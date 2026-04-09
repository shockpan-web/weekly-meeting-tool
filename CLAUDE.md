# FocusBoard — Development Guidelines

## Language
All UI-facing text (labels, buttons, messages, placeholders, tooltips, etc.) must be in **English**.
Do not introduce Japanese or other languages into the interface, even when the surrounding code comments are in Japanese.

## Project Overview
FocusBoard is a serverless team weekly-meeting dashboard.
- No backend server, no external API calls at runtime
- Data flow: Email → Power Automate → Excel (OneDrive)
- See `docs/FocusBoard_Complete_Spec_v4.0.md` for full specification

## Constraints
- No server-side code
- No API keys or authenticated endpoints in the frontend
- All data submission via `mailto:` links
