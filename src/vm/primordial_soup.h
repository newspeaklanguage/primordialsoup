/*
 * Copyright (c) 2017, the Dart project authors.  Please see the AUTHORS file
 * for details. All rights reserved. Use of this source code is governed by a
 * BSD-style license that can be found in the LICENSE file.
 */

#ifndef VM_PRIMORDIAL_SOUP_H_
#define VM_PRIMORDIAL_SOUP_H_

#include <stddef.h>

#ifdef __cplusplus
#define PSOUP_EXTERN_C extern "C"
#else
#define PSOUP_EXTERN_C
#endif

PSOUP_EXTERN_C void PrimordialSoup_Startup(void* snapshot,
                                           size_t snapshot_length);
PSOUP_EXTERN_C void PrimordialSoup_Shutdown();
PSOUP_EXTERN_C void PrimordialSoup_RunIsolate(int argc, const char** argv);
PSOUP_EXTERN_C void PrimordialSoup_InterruptAll();

#endif /* VM_PRIMORDIAL_SOUP_H_ */
