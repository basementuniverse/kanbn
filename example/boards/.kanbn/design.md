---
# Board-scoped: this board has its own workflow, and its own idea of started and completed
startedColumns:
  - Designing
completedColumns:
  - 'Signed Off'

# ...and its own state fields, so design progress is tracked separately from engineering progress on
# the same shared task files. Without these, moving a task to "Signed Off" here would set the
# shared `completed` date and mark it done on the engineering board too
startedField: designStartedAt
completedField: designSignedOffAt
---

# Design Pipeline

Design work across the product, tracked separately from engineering delivery. Tasks here are the
same task files the engineering board uses - a task can sit in a different column on each.

## Ideas

- [design-onboarding-checklist](tasks/design-onboarding-checklist.md)

## Designing

- [build-tenant-settings-page](tasks/build-tenant-settings-page.md)
- [refresh-marketing-site](tasks/refresh-marketing-site.md)

## Signed Off

- [create-organization-switcher](tasks/create-organization-switcher.md)
