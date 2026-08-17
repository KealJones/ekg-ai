# GitHub Sync Skill

Use this workflow when working on EKG-AI from ChatGPT's sandbox, where the local shell has no GitHub network/DNS access but the GitHub connector has authenticated repository access.

## Source of truth
- GitHub branch is the durable source of truth.
- Local sandbox checkout/mirror is the execution workspace.
- GitHub connector is the transport for changed files only.
- GitHub Actions is the independent final verification path.

## Preferred workflow

1. Start from the newest available full repository snapshot in the sandbox.
   - Prefer a user-uploaded GitHub ZIP of the target branch when available.
   - Otherwise use the existing local mirror and reconcile any connector-side changes before editing.
2. Preserve the local `.git` directory if present.
3. Make all code changes locally first.
4. Run the full local test suite and frozen benchmark before syncing:
   - `npm test`
   - `npm run benchmark:report`
5. Inspect exactly what changed:
   - `git status --short`
   - `git diff --name-only`
   - `git diff`
6. Only sync those changed paths through the authenticated GitHub connector.
   - Fetch the current branch version first to obtain its SHA.
   - Use create/update/delete operations as appropriate.
   - Do not blindly rewrite unrelated files.
7. After connector sync, let GitHub Actions run on the branch.
8. Verify CI result before claiming the change is done.
9. If local and GitHub state diverge materially, stop using the stale mirror and request/provide a fresh branch ZIP rather than guessing.

## Full snapshot fallback

If a fresh branch snapshot is needed, give the user this form of URL:

`https://github.com/<owner>/<repo>/archive/refs/heads/<branch>.zip`

For the current v0.3 branch:

`https://github.com/KealJones/ekg-ai/archive/refs/heads/v0.3-preregistered-experiment.zip`

The user can download that ZIP and upload it into the conversation. Extract it into a new sandbox working directory, then continue with the preferred workflow above.

## Important constraints

- Do not assume local `git`, `curl`, `wget`, or `git clone` can reach GitHub; this sandbox may have no DNS/network.
- Do not assume GitHub connector credentials are available to the local shell.
- Do not claim a GitHub write happened until the connector confirms it.
- Do not claim tests passed unless they actually ran locally or in GitHub Actions.
- Keep preregistration files frozen unless intentionally versioning the benchmark.
