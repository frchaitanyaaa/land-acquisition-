---
title: BhoomiSetu
emoji: 🗺️
colorFrom: blue
colorTo: yellow
sdk: docker
app_port: 7860
pinned: true
short_description: SIH 26016 — national land acquisition, demo prototype
---

# BhoomiSetu — SIH 26016 prototype

Real-time national land acquisition and management system. **All data is synthetic** (demo mode); payments,
identity, land records, SMS and the language model are mock services, labelled MOCK in the app.

Open the app at the direct link (`https://<owner>-bhoomisetu.hf.space`), not inside the Hugging Face page frame,
so sign-in cookies work. The landing page lists one demo account per screen (password `bhoomisetu-demo`).

The Space sleeps after a period without visitors; the first visit after that takes 1–2 minutes while the
database, blockchain node and demo data start. Every restart returns the demo to its starting state.

Source: https://github.com/frchaitanyaaa/land-acquisition-
