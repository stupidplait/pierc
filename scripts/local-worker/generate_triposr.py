#!/usr/bin/env python3
"""Reference LOCAL generator for the pull-worker (see docs/22-local-fallback.md).

Wraps TripoSR (https://github.com/VAST-AI-Research/TripoSR — MIT, ~6 GB VRAM, the
lightest/most installable image-to-3D model) so the worker's GENERATE_CMD can call
it to turn an input image into a .glb:

    GENERATE_CMD="python scripts/local-worker/generate_triposr.py {in} {out}"

Prereqs: clone TripoSR, install its requirements, then point TRIPOSR_DIR at the
clone. Swap in Stable-Fast-3D or TRELLIS the same way — any "image in → .glb out"
CLI works; this wrapper just normalizes the output path to {out}.
"""
import os
import shutil
import subprocess
import sys
import tempfile


def main() -> None:
    if len(sys.argv) != 3:
        print("usage: generate_triposr.py <input_image> <output_glb>", file=sys.stderr)
        sys.exit(2)
    in_image, out_glb = sys.argv[1], sys.argv[2]

    triposr = os.environ.get("TRIPOSR_DIR")
    if not triposr or not os.path.isdir(triposr):
        print("Set TRIPOSR_DIR to your TripoSR checkout.", file=sys.stderr)
        sys.exit(1)

    with tempfile.TemporaryDirectory() as out_dir:
        subprocess.run(
            [
                sys.executable,
                os.path.join(triposr, "run.py"),
                in_image,
                "--output-dir",
                out_dir,
                "--model-save-format",
                "glb",
            ],
            check=True,
            cwd=triposr,
        )
        # TripoSR writes <out_dir>/0/mesh.glb; fall back to any .glb it produced.
        produced = os.path.join(out_dir, "0", "mesh.glb")
        if not os.path.exists(produced):
            produced = next(
                (
                    os.path.join(root, f)
                    for root, _, files in os.walk(out_dir)
                    for f in files
                    if f.endswith(".glb")
                ),
                "",
            )
        if not produced or not os.path.exists(produced):
            print("TripoSR produced no .glb", file=sys.stderr)
            sys.exit(1)
        shutil.copyfile(produced, out_glb)


if __name__ == "__main__":
    main()
