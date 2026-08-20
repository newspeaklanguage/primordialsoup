/* Croquet integration for the Newspeak runtime, linked in via --post-js.
   Extracted verbatim from the working hand-maintained croquetpsoup.js (the tail
   following the emscripten glue), which was the only copy that ever ran. */
var theModel;
var theView;
var localViewId;

function replaceUndefined(obj, seen = new Map()) {
    // Check if the current value is an object and not null
    if (obj && typeof obj === 'object') {
        // If we've already seen this object, return its previously processed copy to avoid infinite recursion
        if (seen.has(obj)) {
            return seen.get(obj);
        }
        
        // Create a copy of the object or array
        let copy = Array.isArray(obj) ? [] : {};
        
        // Store the copy in the Map before processing further to handle cyclic references
        seen.set(obj, copy);
        
        // Recursively process each key/value pair, including inherited properties
        for (let key in obj) {
            // Replace `undefined` with an empty object
            if (obj[key] === undefined) {
                copy[key] = {};
            } else {
                // Recursively process the value
                copy[key] = replaceUndefined(obj[key], seen);
            }
        }
        return copy;
    }
    
    // Return the value if it's not an object (base case)
    return obj;
}

function printJSObjectTree(obj, indent = 0) {
    // Create a string of spaces for indentation
    const indentString = ' '.repeat(indent);

    // Check if the current value is an object and not null
    if (obj && typeof obj === 'object') {
        // If it's an array, print each element
        if (Array.isArray(obj)) {
            console.log(indentString + '[Array]');
            obj.forEach((item, index) => {
                console.log(indentString + `  [${index}]`);
                printJSObjectTree(item, indent + 4);
            });
        } else {
            // If it's an object, print each key/value pair
            console.log(indentString + '{Object}');
            for (let key in obj) {
                if (true) {
                    console.log(indentString + `  ${key}:`);
                    printJSObjectTree(obj[key], indent + 4);
                }
            }
        }
    } else {
        // If it's not an object, just print the value
        console.log(indentString + obj);
    }
}

function sanitizeKeydownEvent(kde) {
    return {
        key: kde.key,
	metaKey: kde.metaKey,
	ctrlKey: kde.ctrlKey,
	shiftKey: kde.shiftKey,
	altKey: kde.altKey
    }

}
function storeModelAndView(m, v) {
    theModel = m;
    theView = v;
    croquetInitDone = true;
}

function newspeakFragmentData(fid, data) {
    return {fid: fid, data: data}
}

function nsCodeMirrorChange(change) {
    return {from: nsCursorPos(change.from.ch, change.from.line),
	    to:  nsCursorPos(change.to.ch, change.to.line),
	    text: change.text,
	    removed: change.removed
	   }
}

function nsCodeMirrorSelectionChange(change) {
    var from = change.ranges[0].anchor;
    var to = change.ranges[0].head;
    return {anchor: {line: from.line, ch: from.ch},
	    head: {line: to.line, ch: to.ch}
	   }
}

function nsPopstateData(event){
    return {state: event.state}
}

function nsCursorPos(ch, line) {
    return {ch: ch, line: line}
}

function nsCodeMirrorData(textBeingAccepted, change) {
    return {
	textBeingAccepted: textBeingAccepted,
	change: change
    }
}


function nsTextEditorData(textBeingAccepted, selectionStart, selectionEnd) {
    return {
	textBeingAccepted: textBeingAccepted,
	selectionStart: selectionStart,
	selectionEnd: selectionEnd
    }
}

function fileish(fd) {
    /* Why not just create a File object? Because the File API is not invertible; you cannot pass it the webkitRelativePath property. On the other hand,
some APIs we use (like JSZip) insist on taking File. So we probably will scrap this code. */
    buffer = fd.arrayBuff;
    
    return {
	name: fd.name,
	type: fd.type,
	lastModified: fd.lastModified,
	webkitRelativePath: fd.webkitRelativePath,
        arrayBuffer: function() {
            return Promise.resolve(buffer);
        },
        bytes: function() {
            return Promise.resolve(new Uint8Array(buffer));
        },
        slice: function(start = 0, end = buffer.byteLength) {
            const slicedBuffer = buffer.slice(start, end);
            return Promise.resolve(slicedBuffer);
        },
        stream: function() {
            const readableStream = new ReadableStream({
                start(controller) {
                    controller.enqueue(new Uint8Array(buffer));
                    controller.close();
                }
            });
            return Promise.resolve(readableStream);
        },
        text: function() {
            const decoder = new TextDecoder();
            const text = decoder.decode(buffer);
            return Promise.resolve(text);
        }
    };
}

// The number of the last event processed by this client
var lastProcessedEvent = 0;

// convenience method to increment the processed event count. Easier to call from Newspeak.
function eventProcessed() {
    lastProcessedEvent++;
}

/* 
A map describing all the subscription handlers Newspeak has to Croquet events. 
Each entry lists the scope, event spec and handler for a given subscription. This is needed, so that we can replay them when Croquet creates a new view, which it does when it restores from a snapshot. At that point, all our existing subscriptions are gone, and we have to resubscribe. See replaySubscriptions()
*/
var newspeakSubscriptions = new Map();

function replaySubscriptions() {
    for (let s of newspeakSubscriptions.values()){
	theView.subscribe(s.scope, s.eventSpec, s.handler);
    }
}

/* Large-payload detour.

   The Croquet client SILENTLY DROPS any reflector message whose payload exceeds
   16KB (PAYLOAD_LIMIT_MAX in controller.js, with a console.warn). The event then
   reaches no model, no history, and no client's handler -- including the
   sender's, whose DOM already shows the local edit. Since the editor fragments
   publish their full buffer text on every keystroke, one large-enough editor
   (e.g. a document's raw view) permanently desynchronized the session at the
   first oversized keystroke.

   The cure is the one files already use (see FileChooserFragment in
   HopscotchForCroquet.ns): store the payload with the session Data API -- which
   puts the encrypted bytes on the file server -- and publish only the returned
   handle. On dispatch, fetch and decode before invoking the subscriber. Handles
   serialize through events, the model's event history and snapshots, so replay
   and late joiners work unchanged.

   Ordering: store and fetch are asynchronous, and editor events carry the full
   text, so applying a stale event after a newer one would regress the buffer.
   Both directions are therefore serialized through FIFO promise chains: a
   publish waits for the stores of all earlier publishes, and a dispatch waits
   for the fetches of all earlier dispatches. Events arrive at human input rate,
   so the queues cost nothing.

   Exemption: payloads that already contain DataHandles (the file events). A
   handle's fields live under Symbol keys, invisible to JSON, so a JSON detour
   would destroy it. Those payloads are file METADATA and stay far below the
   cap regardless. */

const NS_DETOUR_LIMIT = 8 * 1024;  // half of Croquet's hard 16KB cap, for margin

function nsIsDataHandle(x) {
    if (!x || typeof x !== 'object') return false;
    if (typeof Croquet !== 'undefined' && Croquet.Data) {
	if (x instanceof Croquet.Data) return true;
	// Duck-type fallback: toId() answers a non-empty id only for a real
	// handle; anything else returns '' or throws on the malformed URL.
	try { return Croquet.Data.toId(x) !== ''; } catch (e) { return false; }
    }
    return false;
}

function nsContainsDataHandle(x, depth = 0) {
    if (!x || typeof x !== 'object' || depth > 8) return false;
    if (nsIsDataHandle(x)) return true;
    for (const k in x) {
	if (nsContainsDataHandle(x[k], depth + 1)) return true;
    }
    return false;
}

var nsPublishChain = Promise.resolve();

// The single outbound funnel: HopscotchForCroquet's publish:event:data: calls
// this instead of theView.publish directly.
function nsPublish(scope, eventSpec, data) {
    nsPublishChain = nsPublishChain.then(async () => {
	try {
	    let payload = data;
	    // Only {fid, data} envelopes can carry something big; bare payloads
	    // (button clicks etc.) are fragment ids and stay tiny.
	    const isEnvelope = data && typeof data === 'object'
		  && 'fid' in data && 'data' in data;
	    if (isEnvelope
		&& JSON.stringify(data).length > NS_DETOUR_LIMIT
		&& !nsContainsDataHandle(data.data)) {
		const bytes = new TextEncoder().encode(JSON.stringify(data.data));
		const handle = await theView.session.data.store(bytes.buffer);
		payload = {fid: data.fid, data: {__nsDetouredPayload: true, handle: handle}};
	    }
	    theView.publish(scope, eventSpec, payload);
	} catch (err) {
	    console.error('nsPublish (' + scope + ' ' + eventSpec + ') failed; event not sent:', err);
	}
    });
}

var nsDispatchChain = Promise.resolve();

// Resolve a possibly-detoured event payload: fetch and decode if it is a
// handle envelope, otherwise pass it through. Shared by live dispatch and
// replay.
async function nsResolvePayload(e) {
    if (e && e.__nsDetouredPayload) {
	const buffer = await theView.session.data.fetch(e.handle);
	return JSON.parse(new TextDecoder().decode(buffer));
    }
    return e;
}

// The single inbound funnel: HopscotchForCroquet's
// subscribeFragment:scope:eventSpec:handler: calls this. It records the wrapped
// handler in newspeakSubscriptions -- so resubscription after a snapshot
// restore (replaySubscriptions) goes through the same wrapper -- and subscribes
// it. The RAW handler is recorded too: replayEvents must invoke handlers
// inline from its own chain thunks (see there), where calling the wrapped form
// would re-enqueue and decouple lookup order from execution order.
function nsSubscribe(scope, eventSpec, handler) {
    const wrapped = e => {
	nsDispatchChain = nsDispatchChain.then(async () => {
	    try {
		handler(await nsResolvePayload(e));
	    } catch (err) {
		console.error('Newspeak dispatch (' + scope + ' ' + eventSpec + ') failed; event skipped:', err);
	    }
	});
    };
    newspeakSubscriptions.set(scope + eventSpec,
	{scope: scope, eventSpec: eventSpec, handler: wrapped, raw: handler});
    theView.subscribe(scope, eventSpec, wrapped);
}

// Root model. See HopscotchForCroquet.ns for an overview of how
// things work.

class NewspeakCroquetModel extends Croquet.Model {
/*
Several things that are not evident from the Croquet docs.

When Croquet restores the model from a snapshot, a fresh instance of the root model class is instantiated. The instance's init() method is called (this seems to contradict the docs, which say init() is called only once per session). 

This of course implies that it explicitly resubscribes; we explictly unsubscribe the old model.

Now, the view-join event is  processed. 

Hence no snapshot state is available at that point. 

Note that a view-join can happen even without a snapshot.

Only afterward is the snapshot state restored in the new model. Next a new root view object is instantiated, with the new model as an argument. 
*/
    
    addEvent(e){
	this.newspeakEvents.push(e);
    }

    publishEventAndData(scope, eventSpec, data, fid) {
	this.addEvent({scope: scope, eventSpec: eventSpec, fid: fid, data: data});
	this.publish(scope + fid, eventSpec, data);
    }

    publishEvent(scope, eventSpec, fid) {
	this.addEvent({scope: scope, eventSpec: eventSpec, fid: fid, data: fid});
	this.publish(scope + fid, eventSpec);
    }
    
    init() {  // runs when a new session is initiated OR when a new shapshot is deserialized. Thus, not the right place to start up Newspeak

	// If we had a prior model (every time this runs except the first)
	// then we get rid of its subscriptions
	if (theModel) theModel.unsubscribeAll();
	// A list of all events ever sent to the model
	this.newspeakEvents = [];

	// Leaf fragment support; issues: scope differs by fragment class (no such thing as nsFragmentId)
	this.subscribe(this.sessionId, 'onMouseDown', this.mouseDown);
	this.subscribe(this.sessionId, 'onMouseEnter', this.mouseEnter);
	this.subscribe(this.sessionId, 'onMouseMove', this.mouseMove);
	this.subscribe(this.sessionId, 'onMouseOut', this.mouseOut);
	this.subscribe(this.sessionId, 'onMouseOver', this.mouseOver);
	this.subscribe(this.sessionId, 'onMouseUp', this.mouseUp);
	this.subscribe(this.sessionId, 'onTouchCancel', this.touchCancel);
	this.subscribe(this.sessionId, 'onTouchEnd', this.touchEnd);
	this.subscribe(this.sessionId, 'onTouchMove', this.touchMove);
	this.subscribe(this.sessionId, 'onTouchStart', this.touchStart);
	this.subscribe(this.sessionId, 'onWheel', this.wheel);
	
	this.subscribe('nsbutton_', 'button_click', this.button_click);
	this.subscribe('nsImagebutton_', 'image_button_click', this.image_button_click);
	this.subscribe('nshyperlink_', 'hyperlink_click', this.hyperlink_click);
	this.subscribe('nshyperlinkImage_', 'hyperlink_image_click', this.hyperlink_image_click);
	this.subscribe('nscheckbox_', 'checkBox_checked', this.checkBox_checked);
	this.subscribe('nscheckbox_', 'checkBox_unchecked', this.checkBox_unchecked);	
	this.subscribe('nsradiobutton_', 'radioButton_released', this.radioButton_released);
	this.subscribe('nsradiobutton_', 'radioButton_pressed', this.radioButton_pressed);	
	this.subscribe('nscodemirror_', 'codeMirror_beforeChange', this.codeMirror_beforeChange);
	this.subscribe('nscodemirror_', 'codeMirror_change', this.codeMirror_change);
	this.subscribe('nscodemirror_', 'codeMirror_keydown', this.codeMirror_keydown);
	this.subscribe('nscodemirror_', 'codeMirror_accept', this.codeMirror_accept);
	this.subscribe('nscodemirror_', 'codeMirror_cancel', this.codeMirror_cancel);
 	this.subscribe('nscodemirror_', 'codeMirror_beforeSelectionChange', this.codeMirror_beforeSelectionChange);	
	this.subscribe('nstexteditor_', 'textEditor_accept', this.textEditor_accept);
	this.subscribe('nstexteditor_', 'textEditor_change', this.textEditor_change);
	this.subscribe('nstexteditor_', 'textEditor_cancel', this.textEditor_cancel);
	this.subscribe('nstogglecomposer_', 'toggleComposer_toggle', this.toggleComposer_toggle);
	this.subscribe('nspicker_', 'picker_pick', this.picker_pick);
	this.subscribe('nscolorpicker_', 'colorPicker_pick', this.color_picker_pick);
	this.subscribe('nsdatepicker_', 'datePicker_pick', this.date_picker_pick);
	this.subscribe('nstimepicker_', 'timePicker_pick', this.time_picker_pick);
	this.subscribe('nsslider_', 'slider_pick', this.slider_pick);
	this.subscribe('nsdropdownmenu_', 'dropDownMenu_click', this.dropDownMenu_click);
        this.subscribe('nsmenu_', 'menu_click', this.menu_click);
        this.subscribe('nsshell_', 'shell_userBack', this.shell_userBack);
        this.subscribe('nsshell_', 'shell_activeMenuBlurred', this.shell_activeMenuBlurred);	
	this.subscribe('nsfilechooser_', 'fileChooser_click', this.fileChooser_click);
	this.subscribe('nsmediacreator_', 'mediaCreator_setFile', this.mediaCreator_setFile);
    }
    // same issues with scope for these methods
    mouseDown(fid){
	console.log('MouseDown ' + fid);
	this.publish(fid, 'model_mouseDown');
    }
    mouseEnter(fid){
	console.log('MouseEnter ' + fid);
	this.publish(fid, 'model_mouseEnter');
    }
    mouseMove(fid){
	console.log('MouseMove ' + fid);
	this.publish(fid, 'model_mouseMove');
    }
    mouseOut(fid){
	console.log('MouseOut ' + fid);
	this.publish(fid, 'model_mouseOut');
    }
    mouseOver(fid){
	console.log('MouseOver ' + fid);
	this.publish(fid, 'model_mouseOver');
    }
    mouseUp(fid){
	console.log('MouseUp ' + fid);
	this.publish(fid, 'model_mouseUp');
   }
   touchCancel(fid){
	console.log('TouchCancel ' + fid);
	this.publish(fid, 'model_touchCancel');
   }
   touchEnd(fid){
	console.log('TouchEnd ' + fid);
	this.publish(fid, 'model_touchEnd');
   }	
   touchMove(fid){
	console.log('TouchMove ' + fid);
	this.publish(fid, 'model_touchMove');
   }
   touchStart(fid){
	console.log('TouchStart ' + fid);
	this.publish(fid, 'model_touchStart');
   }
   wheel(fid){
	console.log('Wheel ' + fid);
	this.publish(fid, 'model_wheel');
   }    // end leaf methods
    button_click(fid){
	this.publishEvent('nsbutton_', 'model_button_click', fid);
    }
    image_button_click(fid){
	this.publishEvent('nsImagebutton_', 'model_image_button_click', fid);
    }
    hyperlink_click(fid){
	this.publishEvent('nshyperlink_', 'model_hyperlink_click', fid);
    }
    hyperlink_image_click(fid){
	this.publishEvent('nshyperlinkImage_', 'model_hyperlink_image_click', fid);
    }
   
    checkBox_checked(fid){
//	console.log('model checkbox checked');
	this.publishEvent('nscheckbox_', 'model_checkBox_checked', fid);
    }
    checkBox_unchecked(fid){
//	console.log('model checkbox unchecked');	
	this.publishEvent('nscheckbox_', 'model_checkBox_unchecked', fid);
    }
    radioButton_released(fid){
	this.publishEvent('nsradiobutton_', 'model_radioButton_released', fid);
    }
    radioButton_pressed(fid){
	this.publishEvent('nsradiobutton_', 'model_radioButton_pressed', fid);
    }
    codeMirror_beforeChange(nsOptions){
	this.publishEventAndData('nscodemirror_', 'model_codeMirror_beforeChange', nsOptions.data, nsOptions.fid);
    }
    codeMirror_change(nsOptions){
	this.publishEventAndData('nscodemirror_', 'model_codeMirror_change', nsOptions.data, nsOptions.fid);
    }
    codeMirror_keydown(nsOptions){
	this.publishEventAndData('nscodemirror_', 'model_codeMirror_keydown', nsOptions.data, nsOptions.fid);
    }
    codeMirror_accept(nsOptions){
	this.publishEventAndData('nscodemirror_', 'model_codeMirror_accept', nsOptions.data, nsOptions.fid);
    }
    codeMirror_cancel(nsOptions){
	this.publishEventAndData('nscodemirror_', 'model_codeMirror_cancel', nsOptions.data, nsOptions.fid);
    }
    codeMirror_beforeSelectionChange(nsOptions){
	this.publishEventAndData('nscodemirror_', 'model_codeMirror_beforeSelectionChange', nsOptions.data, nsOptions.fid);
    }    
    textEditor_accept(nsOptions){
	this.publishEventAndData('nstexteditor_', 'model_textEditor_accept', nsOptions.data, nsOptions.fid);
    }
    textEditor_change(nsOptions){
	this.publishEventAndData('nstexteditor_', 'model_textEditor_change', nsOptions.data, nsOptions.fid);
    }
    textEditor_cancel(nsOptions){
	this.publishEventAndData('nstexteditor_', 'model_textEditor_cancel', nsOptions.data, nsOptions.fid);
    }
    toggleComposer_toggle(fid){
	this.publishEvent('nstogglecomposer_', 'model_toggleComposer_toggle', fid);
    }     
    picker_pick(nsOptions){
	this.publishEventAndData('nspicker_', 'model_picker_pick', nsOptions.data, nsOptions.fid);
    }
    color_picker_pick(nsOptions){
	this.publishEventAndData('nscolorpicker_', 'model_colorPicker_pick', nsOptions.data, nsOptions.fid);
    }
    date_picker_pick(nsOptions){
	this.publishEventAndData('nsdatepicker_', 'model_datePicker_pick', nsOptions.data, nsOptions.fid);
    }    
    time_picker_pick(nsOptions){
	this.publishEventAndData('nstimepicker_', 'model_timePicker_pick', nsOptions.data, nsOptions.fid);
    }
    slider_pick(nsOptions){
	this.publishEventAndData('nsslider_', 'model_slider_pick', nsOptions.data, nsOptions.fid);
    }     
    dropDownMenu_click(fid){
	this.publishEventAndData('nsdropdownmenu_', 'model_dropDownMenu_click', fid, fid);
    }
    menu_click(nsOptions){
	this.publishEventAndData('nsmenu_', 'model_menu_click', nsOptions.data, nsOptions.fid);
    }
    shell_userBack(nsOptions){
	this.publishEventAndData('nsshell_', 'model_shell_userBack', nsOptions.data, nsOptions.fid);
    }
    shell_activeMenuBlurred(fid){
	console.log('shell_activeMenuBlurred ' + fid);
	this.publishEvent('nsshell_', 'model_shell_activeMenuBlurred', fid);
    }     
    fileChooser_click(nsOptions){
	this.publishEventAndData('nsfilechooser_', 'model_fileChooser_click', nsOptions.data, nsOptions.fid);
    }
    mediaCreator_setFile(nsOptions){
	this.publishEventAndData('nsmediacreator_', 'model_mediaCreator_setFile', nsOptions.data, nsOptions.fid);
    }    
}


NewspeakCroquetModel.register("NewspeakCroquetModel");

class NewspeakCroquetView extends Croquet.View {
    constructor(model, presenter) {
	super(model);
	console.log("croquet sessio id = " + this.sessionId);
	localViewId = this.viewId;
	this.presenter = presenter;
        storeModelAndView(model, this);
        replaySubscriptions();
	this.replay();   	
	if (croquetDepActive) {
	    removeRunDependency(croquetDepId);
	    croquetDepActive = false;
        }
    }

    // Newspeak subscriptions arrive via nsSubscribe (above), which records the
    // wrapped handler in newspeakSubscriptions and subscribes it. This method
    // remains ONLY for compatibility with vfuels older than the large-payload
    // detour, whose subscribeFragment: calls it (followed by a direct
    // subscribe). Such handlers cannot resolve detoured payloads -- removing
    // this method entirely made a stale cached vfuel die at its first
    // subscription, during boot, with a blank screen.
    addSubscription(scope, eventSpec, handler) {
	newspeakSubscriptions.set(scope + eventSpec, {scope: scope, eventSpec: eventSpec, handler: handler});
    }

    storedData() {return this.session.data}
    
    replayEvents(from) {
	// If Newspeak has not run yet (fresh client: this is the constructor's
	// replay), no fragment has subscribed and we cannot replay; Newspeak
	// will ask again after the first presenter is displayed.
	if (newspeakSubscriptions.size === 0) return;
	const total = theModel.newspeakEvents.length;
	for (var i = from; i < total; i++) {
	    const e = theModel.newspeakEvents[i];
	    // the key to find the handler is the event scope (indicating the
	    // type of fragment) followed by the fragment id
	    // followed by the eventSpec
	    const k = e.scope + e.fid + e.eventSpec;
	    const n = i;
	    // Enqueue on the dispatch chain; live events arriving meanwhile
	    // queue up behind and stay in order. The subscription lookup MUST
	    // happen inside the thunk, at execution time: the target fragment
	    // is typically constructed by an EARLIER replayed event (a
	    // navigation, an editor opening), or by deferred content that
	    // realizes across animation frames afterwards. A lookup at enqueue
	    // time -- or a synchronous loop, as this originally was -- runs
	    // before any of that construction and finds nothing.
	    nsDispatchChain = nsDispatchChain.then(async () => {
		// Wait for the subscriber to appear while deferred content
		// drains (one action per animation frame; big pages take
		// seconds). The timeout only bites for events whose fragment
		// will never exist -- a genuinely diverged or stale session --
		// where slow catch-up beats wrong catch-up.
		let s = newspeakSubscriptions.get(k);
		let waited = 0;
		while (!s && waited < 15000) {
		    await new Promise(r => setTimeout(r, 100));
		    waited += 100;
		    s = newspeakSubscriptions.get(k);
		}
		if (!s) {
		    console.warn('Croquet replay: no subscriber for key "' + k +
			'" (scope=' + e.scope + ' fid=' + e.fid + ' event=' + e.eventSpec +
			') after ' + waited + 'ms, event ' + n + ' of ' + total + ' - skipped');
		    return;
		}
		try {
		    // raw, not the wrapped handler: wrapped would re-enqueue at
		    // the chain's tail, decoupling execution from this slot.
		    // (s.raw missing means an old-vfuel handler registered via
		    // addSubscription; it is already raw.)
		    (s.raw || s.handler)(await nsResolvePayload(e.data));
		} catch (err) {
		    console.error('Croquet replay of "' + k + '" failed; event skipped:', err);
		}
	    });
	}
    }
    // Also called by Newspeak when it starts up the first time
    replay() {this.replayEvents(lastProcessedEvent)};
}

/**
Produce an object emulating window.localStorage. We want to have distinct
local storage per croquet session, so that apps and sessions don't step on each other's persistent state, invalidating the sync process.

Each such per-session object gets stored in regular local storage.
Therefore, we must JSONify and de-JSONify the data.
*/
function createSessionStorage(sessionId, {prefix = "app-session:"} = {}) {
  const storageKey = `${prefix}${sessionId}`;

  function load() {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : {};
  }

  function save(data) {
    localStorage.setItem(storageKey, JSON.stringify(data));
  }

  return {
    getItem(key) {
      const data = load();
      return data.hasOwnProperty(key) ? data[key] : null;
    },

    setItem(key, value) {
      const data = load();
      data[key] = String(value); // match localStorage behavior
      save(data);
    },

    removeItem(key) {
      const data = load();
      delete data[key];
      save(data);
    },

    clear() {
      save({});
    },

    key(index) {
      const keys = Object.keys(load());
      return keys[index] || null;
    },

    get length() {
      return Object.keys(load()).length;
    }
  };
}


/**
 * getURIParam(paramName)
 * 
 * Retrieves a named parameter from the current page's URL or, if not found, from localStorage.
 * 
 * Behavior:
 * 1. Checks the current URL's query string for the parameter.
 * 2. If found, stores the value in localStorage under the same key for persistence.
 * 3. If not found in the URL, attempts to retrieve the value from localStorage.
 * 4. Returns the value as a string if found, or null if not found in either place.
 * 
 * Design decisions:
 * - If the value is only found in localStorage, it is *not* written back to the URL.
 *   This avoids exposing potentially sensitive information in the address bar.
 * - The return value is consistently `null` when the parameter is not found, never `undefined`.
 * - This pattern supports one-time setup via query parameters, with silent persistence afterward.
 * 
 * Example usage:
 *   getURIParam("sessionId"); // "abc123" or null
 * 
 * Notes:
 * - If you want to force the value into the URL for bookmarking/sharing, you could extend
 *   this function later to support an optional `syncToURL` flag.
 */
function getURIParam(paramName) {
  const url = new URL(window.location.href);
  let value = url.searchParams.get(paramName);

  if (value !== null) {
    // Found in URL — persist to localStorage
    localStorage.setItem(paramName, value);
  } else {
    // Not in URL — try getting from localStorage
    value = localStorage.getItem(paramName);
  }
  return value;
}


async function saveBlobWithSaveFilePicker(fileName, fileBlob) {
    let fileHandle;
    let writableStream;

    try {
        // 1. Define options (suggested name)
        const options = { suggestedName: fileName };

        // 2. Open OS Save As dialog (MUST be called within user gesture)
        fileHandle = await window.showSaveFilePicker(options);

        // **CRUCIAL:** Immediately create the writable stream.
        // If the browser grants implicit write permission based on the user gesture,
        // it happens here. We skip the explicit requestPermission() call.
        writableStream = await fileHandle.createWritable();

        // 3. Write the Blob content
        await writableStream.write(fileBlob);

        // 4. Close the stream to finalize the file
        await writableStream.close();
        
        return { success: true };

    } catch (error) {
        // Handle common errors:
        // - AbortError (User cancelled the dialog)
        // - NotAllowedError (If implicit permission failed, as you saw)
        
        console.error('File saving failed:', error);
        
        // Return an error object for the Newspeak side to handle
        return { success: false, error: error.name || 'UnknownError', message: error.message };
    }
}

/**
 * Safely downloads a Blob, using showSaveFilePicker (FSAA) if available,
 * and falling back to the standard <a> tag download otherwise.
 *
 * @param {string} fileName - The desired name for the file (e.g., 'ActorsForJs.ns').
 * @param {Blob} fileBlob - The content to be saved as a Blob object.
 * @returns {Promise<object>} - A promise that resolves with a success/failure object.
 */
async function safeDownloadBlob(fileName, fileBlob) {
    // 1. Feature Detection: Check if the File System Access API is supported.
    if ('showSaveFilePicker' in window) {
        // --- A. USE FILE SYSTEM ACCESS API (for Chrome/Edge/etc.) ---
        try {
            const options = { suggestedName: fileName };
            
            // 2. Opens the OS Save As dialog (relies on active user gesture)
            const fileHandle = await window.showSaveFilePicker(options);

            // 3. Get the writable stream immediately (maintains transient activation)
            const writableStream = await fileHandle.createWritable();

            try {
                // 4. Write the content and close
                await writableStream.write(fileBlob);
            } finally {
                await writableStream.close();
            }
            
            return { success: true, method: 'FSAA' };

        } catch (error) {
            // Handle user cancellation (AbortError) or permission issues (NotAllowedError)
            console.error('FSAA Download failed (may be user cancelled):', error);
            // Treat user cancellation as a successful skip, otherwise an error.
            if (error.name === 'AbortError') {
                return { success: true, method: 'FSAA', message: 'User cancelled save.' };
            }
            return { success: false, method: 'FSAA', error: error.name || 'UnknownError' };
        }

    } else {
        // --- B. FALLBACK: USE STANDARD <a> TAG DOWNLOAD (for Firefox/Safari/etc.) ---
        
        console.warn('FSAA not supported. Falling back to standard download.');

        // 2. Create a temporary object URL for the Blob
        const url = URL.createObjectURL(fileBlob);
        
        // 3. Create and click a temporary anchor tag
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName; // This triggers the browser's automatic renaming behavior
        document.body.appendChild(a);
        a.click();
        
        // 4. Cleanup
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        return { success: true, method: 'Standard', message: 'Standard download started (may be renamed by browser).' };
    }
}

const name = getURIParam("sessionId"); 
// or else Croquet.App.autoSession();
const apiKey = getURIParam("apiKey");// originates from croquet.io/keys
const appId = getURIParam("appId");
const password = getURIParam("pwd"); // Croquet.App.autoPassword();

 




// classes aren't stored in the global object, so assign them to
// variables so we can easily get them from Newspeak
var NSCroquetModel = NewspeakCroquetModel;
var NSCroquetView = NewspeakCroquetView;

Croquet.Session.join({ apiKey, appId, name, password, model: NewspeakCroquetModel, view: NewspeakCroquetView });


// {{MODULE_ADDITIONS}}



