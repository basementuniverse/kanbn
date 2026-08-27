---
# Board-scoped: these belong to the main board alone, and are NOT inherited by design.md
startedColumns:
  - 'In Progress'
completedColumns:
  - Done

# Workspace-scoped: with no config file these live here, and every board inherits them. A custom
# field has to be declared once for the whole workspace, because one task file has to parse
# identically for every board that references it
customFields:
  - name: designStartedAt
    type: date
  - name: designSignedOffAt
    type: date
taskWorkloadTags:
  Tiny: 1
  Small: 2
  Medium: 3
  Large: 5
  Huge: 8
---

# Example SaaS Project

The engineering board. Design work on the same tasks is tracked separately on the `design` board -
run `kanbn boards` to see both, and `kanbn boards --tasks` to see which tasks span them.

## Backlog

- [refresh-marketing-site](tasks/refresh-marketing-site.md)
- [add-usage-alert-emails](tasks/add-usage-alert-emails.md)

## Todo

- [create-organization-switcher](tasks/create-organization-switcher.md)

## In Progress

- [build-tenant-settings-page](tasks/build-tenant-settings-page.md)

## Done

- [ship-billing-portal](tasks/ship-billing-portal.md)
