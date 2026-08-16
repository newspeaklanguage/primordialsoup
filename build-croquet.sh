#!/bin/sh -e
# Build croquetpsoup.js by temporarily swapping post-js files

# Save the regular primordialsoup.* files that were just built
mkdir -p out/.temp
cp out/ReleaseEmscriptenWASM/primordialsoup.html out/.temp/
cp out/ReleaseEmscriptenWASM/primordialsoup.js out/.temp/
cp out/ReleaseEmscriptenWASM/primordialsoup.wasm out/.temp/
cp out/DebugEmscriptenWASM/primordialsoup.html out/.temp/primordialsoup-debug.html
cp out/DebugEmscriptenWASM/primordialsoup.js out/.temp/primordialsoup-debug.js
cp out/DebugEmscriptenWASM/primordialsoup.wasm out/.temp/primordialsoup-debug.wasm

# Save original SConstruct
cp SConstruct SConstruct.bak

# Replace custom-post.js with croquet-post.js in SConstruct
sed -i.tmp "s/'--post-js', 'meta\/custom-post.js'/'--post-js', 'meta\/croquet-post.js'/g" SConstruct

# Force the link step to re-run. Swapping --post-js does not change scons's
# dependency signature, so scons reports "`.' is up to date" and skips the link
# on any run where the C++ sources are unchanged -- and we would then copy the
# restored, NON-Croquet primordialsoup.js to croquetpsoup.js, silently shipping a
# runtime with no Croquet in it at all. The originals are already saved above.
rm -f out/ReleaseEmscriptenWASM/primordialsoup.html \
      out/ReleaseEmscriptenWASM/primordialsoup.js \
      out/ReleaseEmscriptenWASM/primordialsoup.wasm \
      out/DebugEmscriptenWASM/primordialsoup.html \
      out/DebugEmscriptenWASM/primordialsoup.js \
      out/DebugEmscriptenWASM/primordialsoup.wasm

# Build with croquet post-js
case $(uname -s) in
  Darwin) scons -Q --jobs $(sysctl -n hw.ncpu) "$@" ;;
  Linux) scons -Q --jobs $(nproc) "$@" ;;
  *) echo Unknown OS $(uname -s); exit 1 ;;
esac

# Copy newly built output to croquetpsoup.*
cp out/ReleaseEmscriptenWASM/primordialsoup.html out/ReleaseEmscriptenWASM/croquetpsoup.html
cp out/ReleaseEmscriptenWASM/primordialsoup.js out/ReleaseEmscriptenWASM/croquetpsoup.js
cp out/ReleaseEmscriptenWASM/primordialsoup.wasm out/ReleaseEmscriptenWASM/croquetpsoup.wasm

# The whole point of this build: croquet-post.js must actually be in the output.
for js in out/ReleaseEmscriptenWASM/croquetpsoup.js out/DebugEmscriptenWASM/primordialsoup.js; do
  grep -q 'NewspeakCroquetModel' "$js" || {
    echo "ERROR: $js has no Croquet integration -- the link step did not re-run"; exit 1; }
done

cp out/DebugEmscriptenWASM/primordialsoup.html out/DebugEmscriptenWASM/croquetpsoup.html
cp out/DebugEmscriptenWASM/primordialsoup.js out/DebugEmscriptenWASM/croquetpsoup.js
cp out/DebugEmscriptenWASM/primordialsoup.wasm out/DebugEmscriptenWASM/croquetpsoup.wasm

# Emscripten substitutes its own output name into the shell's script tag, so the
# page we just copied loads primordialsoup.js -- the NON-Croquet runtime -- and
# never defines Croquet at all. Point it at croquetpsoup.js and pull in the
# Croquet library, which must be defined before the async runtime script runs;
# a plain script in <head> is executed before anything in <body> starts.
# Everything else in the shell (vendor libraries, CodeMirror, load order) is
# shared with primordialsoup.html and stays in sync automatically.
CROQUET_LIB="https://cdn.jsdelivr.net/npm/@croquet/croquet@2.0.4/pub/croquet.min.js"
for html in out/ReleaseEmscriptenWASM/croquetpsoup.html \
            out/DebugEmscriptenWASM/croquetpsoup.html; do
  sed -i.tmp \
    -e 's|src="primordialsoup.js"|src="croquetpsoup.js"|' \
    -e "s|</head>|  <script src=\"${CROQUET_LIB}\"></script></head>|" \
    "$html"
  rm -f "$html.tmp"
  # Fail loudly rather than shipping a page that silently boots the wrong VM.
  grep -q 'src="croquetpsoup.js"' "$html" || { echo "ERROR: $html not repointed"; exit 1; }
  grep -q 'croquet.min.js' "$html" || { echo "ERROR: $html missing Croquet library"; exit 1; }
done

# Restore the original primordialsoup.* files
cp out/.temp/primordialsoup.html out/ReleaseEmscriptenWASM/
cp out/.temp/primordialsoup.js out/ReleaseEmscriptenWASM/
cp out/.temp/primordialsoup.wasm out/ReleaseEmscriptenWASM/
cp out/.temp/primordialsoup-debug.html out/DebugEmscriptenWASM/primordialsoup.html
cp out/.temp/primordialsoup-debug.js out/DebugEmscriptenWASM/primordialsoup.js
cp out/.temp/primordialsoup-debug.wasm out/DebugEmscriptenWASM/primordialsoup.wasm

# Cleanup
rm -rf out/.temp
mv SConstruct.bak SConstruct
rm -f SConstruct.tmp

echo "Croquet version built successfully"
