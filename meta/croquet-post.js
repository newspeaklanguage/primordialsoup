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

    // Called by Newspeak when any fragment subscribes to an event.
    addSubscription(scope, eventSpec, handler) {
	newspeakSubscriptions.set(scope + eventSpec, {scope: scope, eventSpec: eventSpec, handler: handler});
    }
    
    storedData() {return this.session.data}
    
    replayEvents(from) {
	for (var i = from; i < theModel.newspeakEvents.length; i++) {
            var e = theModel.newspeakEvents[i];
	    // the key to find the handler is the event scope (indicating the
	    // type of fragment) followed by the fragment id
	    // followed by the eventSpec	    
	    var k = e.scope + e.fid + e.eventSpec;
	    // Replay any events we haven't processed, unless this is
	    // the first time we run, so Newspeak has not run yet and
	    // newspeakSubscriptions will be empty, meaning we can't replay yet.
	   // We'll have to wait for Newspeak to run and ask us to replay	
	    if (newspeakSubscriptions.size > 0) {
		newspeakSubscriptions.get(k).handler(e.data);
	    }
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



