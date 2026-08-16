/* Croquet startup gate for the Newspeak runtime, linked in via --pre-js.

   Newspeak's main:args: must not run until the Croquet session has produced a
   view. HopscotchShell>>setupCroquetView reaches for the global theView, and
   Session.join is asynchronous, so without a gate Newspeak boots first, finds
   theView undefined, and dies with

       Alien doesNotUnderstand: #addSubscription:eventSpec:handler:

   We therefore hold an Emscripten run dependency across the join. run() re-checks
   runDependencies after calling preRun precisely so that a preRun callback can do
   this ("a preRun added a dependency, run will be called later"). The release side
   is in NewspeakCroquetView's constructor in croquet-post.js, which calls
   removeRunDependency once storeModelAndView has published the model and view.

   The original hand-maintained croquetpsoup.js did this by editing the generated
   glue directly, naming the dependency with getUniqueRunDependency. That function
   is gone in Emscripten 4.x, and a fixed name is sufficient for a single
   dependency. Using Module['preRun'] keeps it to supported hooks, so nothing here
   depends on the shape of generated code.

   croquetInitDone is read here and assigned by storeModelAndView: if the session
   somehow completes before preRun runs, we take no dependency and never gate. */

var croquetDepId = 'croquet';
var croquetInitDone = false;
var croquetDepActive = false;

Module['preRun'] = Module['preRun'] || [];
Module['preRun'].push(function () {
  if (!croquetInitDone) {
    croquetDepActive = true;
    addRunDependency(croquetDepId);
  }
});
