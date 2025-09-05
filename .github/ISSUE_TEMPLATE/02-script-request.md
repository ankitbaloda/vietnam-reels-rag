name: Script Request (Claude)
about: Turn an approved Idea Card into a script with VO durations
title: "[Script] Short title"
labels: scripting
body:
  - type: textarea
    id: idea-card
    attributes:
      label: Paste Idea Card (Markdown + JSON)
    validations:
      required: true
  - type: textarea
    id: notes
    attributes:
      label: Notes
      description: Persona emphasis, tone adjustments, CTA specifics
