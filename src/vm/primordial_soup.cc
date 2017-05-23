// Copyright (c) 2017, the Dart project authors.  Please see the AUTHORS file
// for details. All rights reserved. Use of this source code is governed by a
// BSD-style license that can be found in the LICENSE file.

#include "vm/primordial_soup.h"

#include "vm/flags.h"
#include "vm/globals.h"
#include "vm/isolate.h"
#include "vm/os.h"
#include "vm/os_thread.h"
#include "vm/port.h"
#include "vm/primitives.h"
#include "vm/snapshot.h"

PSOUP_EXTERN_C void PrimordialSoup_Startup(void* snapshot,
                                           size_t snapshot_length) {
  psoup::OS::Startup();
  psoup::OSThread::Startup();
  psoup::Primitives::Startup();
  psoup::PortMap::Startup();
  psoup::Snapshot::Startup(snapshot, snapshot_length);
  psoup::Isolate::Startup();
}


PSOUP_EXTERN_C void PrimordialSoup_Shutdown() {
  psoup::Isolate::Shutdown();
  psoup::Snapshot::Shutdown();
  psoup::PortMap::Shutdown();
  psoup::Primitives::Shutdown();
  psoup::OSThread::Shutdown();
  psoup::OS::Shutdown();
}


PSOUP_EXTERN_C void PrimordialSoup_RunIsolate(int argc, const char** argv) {
  if (TRACE_ISOLATES) {
    intptr_t id = psoup::OSThread::ThreadIdToIntPtr(
        psoup::OSThread::Current()->trace_id());
    psoup::OS::PrintErr("Starting isolate on thread %" Pd "\n", id);
  }

  psoup::Isolate* isolate = new psoup::Isolate();
  isolate->InitWithStringArray(argc, argv);
  isolate->Interpret();
  delete isolate;

  if (TRACE_ISOLATES) {
    intptr_t id = psoup::OSThread::ThreadIdToIntPtr(
        psoup::OSThread::Current()->trace_id());
    psoup::OS::PrintErr("Finishing isolate on thread %" Pd "\n", id);
  }
}


PSOUP_EXTERN_C void PrimordialSoup_InterruptAll() {
  psoup::Isolate::InterruptAll();
}