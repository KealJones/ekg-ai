# Portable substrate (v0.6)

This is the **practical baseline knowledge** EKG should not waste Teacher time rediscovering.
It is intentionally made from operations that are straightforward to implement across Python,
JavaScript/TypeScript, Node, Rust, and Bash/standard Unix userland.

Two layers are separate on purpose:

- **Pure primitives**: deterministic computation with no outside world.
- **Host capabilities**: explicit OS/runtime boundaries (filesystem, environment, path, clock).

Experimental checkpoints may continue to use `defaultCapabilities()`.
Interactive development should use `ekgCapabilities()`.

## Surface comparison

| Family | Python | JS / TypeScript | Node host | Rust | Bash / Unix | EKG |
|---|---|---|---|---|---|---|
| integer `+ - * / %`, abs/min/max | built-ins | operators / `Math` | same as JS | operators / `std::cmp` | shell arithmetic | pure primitive |
| numeric comparisons | operators | operators | same | operators | `(( ))`, `[[ ]]` | pure primitive |
| boolean AND/OR/NOT | `and/or/not` | `&&/||/!` | same | `&&/||/!` | `&&/||/!` | pure primitive |
| condition/select | conditional expr | ternary | same | `if` expr | arithmetic / shell conditionals | typed select primitives |
| string equality/concat/contains/prefix/suffix | `str` | `String` | same | `String` / `str` | parameter expansion / `[[ ]]` | pure primitive |
| ASCII case + trim + replace | `str` | `String` | same | `str` / `String` | parameter expansion | pure primitive |
| list/array length/concat/reverse/contains | `list` | `Array` | same | `Vec` | indexed arrays | pure primitive |
| integer-list sum/min/max | iteration | `Array` iteration | same | iterator methods | loops over arrays | pure primitive |
| current directory | `os/pathlib` | host-dependent | `process.cwd()` | `std::env` | `$PWD` / `pwd` | host capability |
| environment lookup / argv | `os.environ`, `sys.argv` | host-dependent | `process.env/argv` | `std::env` | variables / `$@` | host capability |
| basename/dirname/ext/join/normalize | `pathlib/os.path` | host-dependent | `node:path` | `std::path` | parameter expansion + standard tools | host capability |
| exists / file / directory | `pathlib` | host-dependent | `node:fs` | `std::fs` | `[[ -e/-f/-d ]]` | host capability |
| list/read/write/append/mkdir/remove/rename | stdlib | host-dependent | `node:fs` | `std::fs` | redirection + standard Unix tools | host capability |
| file size / mtime | `stat` | host-dependent | `fs.stat` | metadata | `stat` / `wc` | host capability |
| unix time | `time` | host-dependent | `Date.now` | `SystemTime` | `date +%s` | host capability |

### Intentionally excluded from the universal default

- **Arbitrary process/shell execution**: universal, but it lets EKG outsource the whole problem and destroys the point of learning.
- **Network access**: not a language-level universal and creates a huge safety/side-effect surface.
- **JSON**: Python/JS/Node support it directly, Rust usually uses `serde_json`, Bash normally needs `jq`; useful later, but not in the strict intersection.
- **Regex**: similarly universal in practice but not in Rust stdlib or Bash as one consistent API/semantics.
- **Randomness**: semantics and ranges differ; no reason to make nondeterminism part of the base brain yet.

## Pure capability inventory

Legacy primitives remain available (`add`, `mul`, `max`, equality/GTE, string length,
string-length argmin/argmax, string-list length). v0.6 adds:

### Integers

`sub_int`, `div_trunc_int`, `mod_trunc_int`, `neg_int`, `abs_int`, `min_int`,
`ne_int`, `lt_int`, `lte_int`, `gt_int`

Division/modulo use **truncate-toward-zero semantics**. Division/modulo by zero return `0`
in the portable substrate so execution remains total and composable.

### Booleans and conditionals

`not_bool`, `and_bool`, `or_bool`, `eq_bool`, plus typed `select_*` for integers,
booleans, strings, string lists, and integer lists.

### Strings

`eq_string`, `concat_string`, `contains_string`, `starts_with_string`,
`ends_with_string`, `ascii_lower_string`, `ascii_upper_string`, `trim_ascii_string`,
`replace_all_string`, `int_to_string`.

`string_len` is normalized to **Unicode code-point count** rather than JavaScript UTF-16
code-unit count, matching Rust `.chars().count()` and Python's ordinary Unicode string length
more closely.

### Lists

Integer-list length; concat/reverse/contains for string and integer lists; integer-list
sum/min/max. Empty integer min/max return `0` so the functions remain total.

## Portable host capability inventory

`cwd`, `env_get`, `args`, `path_basename`, `path_dirname`, `path_ext`, `path_join`,
`path_normalize`, `fs_exists`, `fs_is_file`, `fs_is_dir`, `fs_list`, `fs_read_text`,
`fs_write_text`, `fs_append_text`, `fs_mkdir`, `fs_remove_file`, `fs_rename`, `fs_size`,
`fs_mtime_seconds`, `unix_time_seconds`.

The Node implementation is included now. Python/Rust/Bash adapters can implement the same
semantic interface later without changing learned Blueprints.
