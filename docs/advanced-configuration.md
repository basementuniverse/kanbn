# Advanced Configuration

Kanbn will search for a JSON or YAML configuration file in the root of the directory where it is initialised. The configuration file should be called `kanbn.json` or `kanbn.yml`.

If such a file is found, then project options (which are normally saved as YAML front matter in the index file) will instead be saved into this file.

If any project options are added to the index file, then the next time Kanbn writes to the index the options will be moved into the configuration file.

_Note: in future, it might be possible to split project options between the index and configuration files, but for now configuration must be saved inside only one of these files._

## Configuring default locations

By default, Kanbn will store everything inside the `.kanbn` directory inside your workspace. The index file will be called `index.md` and tasks will be stored inside `.kanbn/tasks/`.

However, these paths can be configured by adding the following optional fields to your `kanbn.json` / `kanbn.yml` file:

```json
{
  "mainFolder": "custom-kanbn-folder",
  "indexFile": "custom-index.md",
  "taskFolder": "custom-task-folder"
}
```
```yaml
mainFolder: custom-kanbn-folder
indexFile: custom-index.md
taskFolder: custom-task-folder
```

_Note: these options must go inside the configuration file in the root of your workspace. If they're added to the index file they will have no effect._

### `mainFolder`

This will rename the main folder where everything is stored. By default this is `.kanbn`.

### `indexFile`

This will rename the index file. By default this is `index.md`. It is relative to the main folder.

### `taskFolder`

This will rename the folder where tasks are stored. By default this is `tasks`. It is relative to the main folder.
