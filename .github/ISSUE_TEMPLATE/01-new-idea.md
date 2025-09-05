name: New Reel Idea
about: Request a new Idea Card + EDL
title: "[Idea] Short title"
labels: ideation
body:
  - type: textarea
    id: brief
    attributes:
      label: Brief
      description: What vibe, location/day(s), target length (30/40/50/60), and theme?
      placeholder: e.g., 40s budget breakdown for Phu Quoc South day w/ cable car + water park
    validations:
      required: true
  - type: textarea
    id: constraints
    attributes:
      label: Constraints
      description: Any must-use clips or must-avoid segments?
  - type: textarea
    id: notes
    attributes:
      label: Notes
      description: Anything else?