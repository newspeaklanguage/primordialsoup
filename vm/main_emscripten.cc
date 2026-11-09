// Copyright (c) 2019, the Newspeak project authors. Please see the AUTHORS file
// for details. All rights reserved. Use of this source code is governed by a
// BSD-style license that can be found in the LICENSE file.

#include "vm/globals.h"
#if defined(OS_EMSCRIPTEN)

#include <emscripten.h>

#include "vm/isolate.h"
#include "vm/message_loop.h"
#include "vm/os.h"
#include "vm/port.h"
#include "vm/primordial_soup.h"

EM_JS(void, _JS_initializeAliens, (), {
  // Two structures. alienTable is index-addressed: an Alien holds an index
  // into it, so entries are never removed. aliens is the operand stack for
  // marshalling values across the bridge, and is consumed exactly. They used
  // to be one array, which left every object argument stranded on the stack
  // (it was its own handle) and clobbered the arguments before it.
  var table = new Array();
  table.push(undefined);  // 0
  table.push(null);       // 1
  table.push(false);      // 2
  table.push(true);       // 3
  table.push(window);     // 4
  Module.alienTable = table;
  Module.aliens = new Array();
});

static psoup::Isolate* isolate;
extern "C" void load_snapshot(void* snapshot, size_t snapshot_length) {
  PrimordialSoup_Startup();
  _JS_initializeAliens();

  uint64_t seed = psoup::OS::CurrentMonotonicNanos();
  isolate = new psoup::Isolate(snapshot, snapshot_length, seed);
  int argc = 0;
  const char** argv = NULL;
  isolate->loop()->PostMessage(new psoup::IsolateMessage(ILLEGAL_PORT,
                                                         argc, argv));
}

extern "C" int handle_message() {
  return static_cast<psoup::EmscriptenMessageLoop*>(isolate->loop())
      ->HandleMessage();
}

extern "C" int handle_signal(int handle, int status, int signals, int count) {
  return static_cast<psoup::EmscriptenMessageLoop*>(isolate->loop())
      ->HandleSignal(handle, status, signals, count);
}

#endif  // defined(OS_EMSCRIPTEN)
