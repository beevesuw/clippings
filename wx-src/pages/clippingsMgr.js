/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


const DEBUG_TREE = false;

const DEFAULT_NEW_CLIPPING_NAME = "New Clipping";
const DEFAULT_NEW_FOLDER_NAME = "New Folder";
const DEFAULT_UNTITLED_CLIPPING_NAME = "Untitled Clipping";
const DEFAULT_UNTITLED_FOLDER_NAME = "Untitled Folder";

let gOS;
let gClippingsDB;
let gClippings;
let gIsClippingsTreeEmpty;
let gIsReloading = false;
let gClippingsTreeDnD = false;
let gDialogs = {};

// Clippings listener object
let gClippingsListener = {
  origin: null,
  
  newClippingCreated: function (aID, aData)
  {
    if (gIsClippingsTreeEmpty) {
      unsetEmptyClippingsState();
    }

    let tree = getClippingsTree();
    let selectedNode = tree.activeNode;
    let newNodeData = {
      key: aID + "C",
      title: sanitizeTreeNodeTitle(DEBUG_TREE ? `${aData.name} [key=${aID}C]` : aData.name)
    };

    let newNode = null;

    if (selectedNode) {
      if (aData.parentFolderID == aeConst.ROOT_FOLDER_ID) {
        newNode = tree.rootNode.addNode(newNodeData);
      }
      else {
        let parentNode = tree.getNodeByKey(aData.parentFolderID + "F");
        newNode = parentNode.addNode(newNodeData);
      }
    }
    else {
      // No clippings or folders.
      newNode = tree.rootNode.addNode(newNodeData);
    }
    
    newNode.makeVisible().then(() => {
      newNode.setActive();
      $("#clipping-name").val(aData.name);
      $("#clipping-text").val("");
    });
  },

  newFolderCreated: function (aID, aData)
  {
    if (gIsClippingsTreeEmpty) {
      unsetEmptyClippingsState();
    }
    
    let tree = getClippingsTree();
    let selectedNode = tree.activeNode;
    let newNodeData = {
      key: aID + "F",
      title: sanitizeTreeNodeTitle(DEBUG_TREE ? `${aData.name} [key=${aID}F]` : aData.name),
      folder: true,
      children: []
    };

    let newNode = null;
    
    if (selectedNode) {
      if (aData.parentFolderID == aeConst.ROOT_FOLDER_ID) {
        newNode = tree.rootNode.addNode(newNodeData);
      }
      else {
        let parentNode = tree.getNodeByKey(aData.parentFolderID + "F");
        newNode = parentNode.addNode(newNodeData);
      }
    }
    else {
      // No clippings or folders.
      newNode = tree.rootNode.addNode(newNodeData);
    }

    newNode.makeVisible().then(() => {
      newNode.setActive();
      $("#clipping-name").val(aData.name);
      $("#clipping-text").val("");
    });
  },

  clippingChanged: function (aID, aData, aOldData)
  {
    let tree = getClippingsTree();

    if (aData.parentFolderID != aOldData.parentFolderID) {
      if (this._isFlaggedForDelete(aData)) {
        this._removeClippingsTreeNode(aID + "C");
      }
      else {
        if (gClippingsTreeDnD) {
          // Avoid handling moved clipping twice.
          gClippingsTreeDnD = false;
          return;
        }
        
        log("Clippings/wx: clippingsMgr.js::gClippingsListener.clippingChanged: Handling clipping move");
        let changedNode = tree.getNodeByKey(aID + "C");
        if (changedNode) {
          let targParentNode;
          if (aData.parentFolderID == aeConst.ROOT_FOLDER_ID) {
            targParentNode = tree.rootNode;
          }
          else {
            targParentNode = tree.getNodeByKey(aData.parentFolderID + "F");
          }
          
          changedNode.moveTo(targParentNode, "child");
        }
        else {
          // Undoing delete.
          let newNodeData = {
            key: aID + "C",
            title: sanitizeTreeNodeTitle(DEBUG_TREE ? `${aData.name} [key=${aID}C]` : aData.name)
          };

          if (aData.parentFolderID == aeConst.ROOT_FOLDER_ID) {
            changedNode = tree.rootNode.addNode(newNodeData);
          }
          else {
            let parentNode = tree.getNodeByKey(aData.parentFolderID + "F");
            changedNode = parentNode.addNode(newNodeData);
          }
        }

        changedNode.makeVisible().then(() => { changedNode.setActive() });
      }
    }
    else if (aData.name != aOldData.name) {
      let changedNode = tree.getNodeByKey(aID + "C");
      changedNode.setTitle(sanitizeTreeNodeTitle(aData.name));
    }
  },

  folderChanged: function (aID, aData, aOldData)
  {
    let tree = getClippingsTree();

    if (aData.parentFolderID != aOldData.parentFolderID) {
      if (this._isFlaggedForDelete(aData)) {
        this._removeClippingsTreeNode(aID + "F");
      }
      else {
        if (gClippingsTreeDnD) {
          // Avoid handling moved folder twice.
          gClippingsTreeDnD = false;
          return;
        }
        
        log("Clippings/wx: clippingsMgr.js::gClippingsListener.folderChanged: Handling folder move");
        let changedNode = tree.getNodeByKey(aID + "F");
        if (changedNode) {
          let targParentNode;
          if (aData.parentFolderID == aeConst.ROOT_FOLDER_ID) {
            targParentNode = tree.rootNode;
          }
          else {
            targParentNode = tree.getNodeByKey(aData.parentFolderID + "F");
          }
          
          changedNode.moveTo(targParentNode, "child");
        }
        else {
          // Undoing delete.
          let newNodeData = {
            key: aID + "F",
            title: sanitizeTreeNodeTitle(DEBUG_TREE ? `${aData.name} [key=${aID}C]` : aData.name),
            folder: true,
            children: []
          };

          if (aData.parentFolderID == aeConst.ROOT_FOLDER_ID) {
            changedNode = tree.rootNode.addNode(newNodeData);
          }
          else {
            let parentNode = tree.getNodeByKey(aData.parentFolderID + "F");
            changedNode = parentNode.addNode(newNodeData);
          }

          this._buildChildNodes(changedNode);
        }
        changedNode.makeVisible().then(() => { changedNode.setActive() });
      }
    }
    else if (aData.name != aOldData.name) {
      let changedNode = tree.getNodeByKey(aID + "F");
      changedNode.setTitle(sanitizeTreeNodeTitle(aData.name));
    }
  },

  clippingDeleted: function (aID, aOldData) {},

  folderDeleted: function (aID, aOldData) {},

  afterBatchChanges: function ()
  {
    gIsReloading = true;
    window.location.reload();
  },

  // Helper methods
  _buildChildNodes: function (aFolderNode)
  {
    let id = parseInt(aFolderNode.key);
    
    gClippingsDB.transaction("r", gClippingsDB.clippings, gClippingsDB.folders, () => {
      gClippingsDB.folders.where("parentFolderID").equals(id).each((aItem, aCursor) => {
        let newFldrNode = aFolderNode.addChildren({
          key: aItem.id + "F",
          title: sanitizeTreeNodeTitle(DEBUG_TREE ? `${aItem.name} [key=${aID}C]` : aItem.name),
          folder: true,
          children: []
        });
        this._buildChildNodes(newFldrNode);
      }).then(() => {
        gClippingsDB.clippings.where("parentFolderID").equals(id).each((aItem, aCursor) => {
          aFolderNode.addChildren({
            key: aItem.id + "C",
            title: sanitizeTreeNodeTitle(DEBUG_TREE ? `${aItem.name} [key=${aID}C]` : aItem.name)
          });
        });
      });
    }).catch(aErr => {
      console.error("Clippings/wx: clippingsMgr.js::gClippingsListener._buildChildNodes(): " + aErr);
    });
  },
  
  _removeClippingsTreeNode: function (aIDWithSuffix)
  {
    let tree = getClippingsTree();
    let targetNode = tree.getNodeByKey(aIDWithSuffix);
    let deletedNodeIdx = targetNode.getIndex();
    let prevSibNode = targetNode.getPrevSibling();
    let nextSibNode = targetNode.getNextSibling();
    let parentNode = targetNode.getParent();
    
    targetNode.remove();

    if (tree.count() == 0) {
      tree.options.icon = false;
      let emptyMsgNode = setEmptyClippingsState();
      tree.rootNode.addNode(emptyMsgNode);
      setStatusBarMsg("0 items");
    }
    else {
      // Select the node that used to be occupied by the delete node. If the
      // deleted node was the last node of its parent folder, then select the
      // last child of the parent.
      if (nextSibNode) {
        nextSibNode.setActive();
      }
      else if (prevSibNode) {
        prevSibNode.setActive();
      }
      else {
        if (parentNode.isRootNode()) {
          let parentNodes = parentNode.getChildren();
          if (deletedNodeIdx < parentNodes.length) {
            parentNodes[deletedNodeIdx].setActive();
          }
          else {
            parentNodes[parentNodes.length].setActive();
          }
        }
        else {
          parentNode.setActive();
        }
      }
    }
  },

  _isFlaggedForDelete: function (aItem)
  {
    return (aItem.parentFolderID == aeConst.DELETED_ITEMS_FLDR_ID);
  }
};


// Search box
let gSearchBox = {
  _isInitialized: false,
  _isActive: false,
  _numMatches: null,
  _clippingsTree: null,

  init: function ()
  {
    if (this._isInitialized) {
      return;
    }
    
    $("#search-box").keyup(aEvent => {
      this.updateSearch();
    });

    $("#clear-search").click(aEvent => { this.reset() });

    this._isInitialized = true;
  },

  show: function ()
  {
    $("#search-clippings-and-folders").show();
  },

  hide: function ()
  {
    $("#search-clippings-and-folders").hide();
  },
  
  isVisible: function ()
  {
    return ($("#search-clippings-and-folders").css("display") != "none");
  },
  
  isActivated: function ()
  {
    return this._isActive;
  },

  updateSearch: function ()
  {
    let tree = getClippingsTree();
    let numMatches = tree.filterNodes($("#search-box").val());
    if (numMatches === undefined) {
      // User cleared search box by deleting all search text
      setStatusBarMsg();
      this._isActive = false;
    }
    else {
      setStatusBarMsg(`${numMatches} matches`);
    }

    this._numMatches = numMatches;
  },

  getCountMatches: function ()
  {
    return this._numMatches;
  },

  activate: function ()
  {
    this._isActive = true;
  },
  
  reset: function ()
  {
    getClippingsTree().clearFilter();
    $("#search-box").val("").focus();
    setStatusBarMsg();
    this._isActive = false;
  }
};

// Source URL editing
let gSrcURLBar = {
  init: function ()
  {
    $("#src-url-edit-mode").hide();
    $("#edit-url-btn").click(aEvent => { this.edit() });
    $("#edit-src-url-ok").click(aEvent => { this.acceptEdit() });
    $("#edit-src-url-cancel").click(aEvent => { this.cancelEdit() });
  },

  show: function ()
  {
    $("#source-url-bar").show();
  },

  hide: function ()
  {
    $("#source-url-bar").hide();
  },

  isVisible: function ()
  {
    return ($("#source-url-bar:visible").length > 0);
  },

  keypress: function (aEvent)
  {

  },

  edit: function ()
  {
    $("#src-url-normal-mode").hide();
    $("#src-url-edit-mode").show();
    $("#clipping-src-url-edit").val($("#clipping-src-url > a").text()).select().focus();
  },

  isEditing: function ()
  {
    return ($("#src-url-edit-mode:visible").length > 0);
  },

  acceptEdit: function ()
  {
    let tree = getClippingsTree();
    let id = parseInt(tree.activeNode.key);
    let updatedURL = $("#clipping-src-url-edit").val();
    
    gClippingsDB.clippings.update(id, {
      sourceURL: updatedURL
    }).then(aNumUpdated => {
      if ($("#clipping-src-url > a").length == 0) {
        $("#clipping-src-url").html(`<a href="${updatedURL}">${updatedURL}</a>`);
      }
      else {
        if (updatedURL) {
          $("#clipping-src-url > a").text(updatedURL);
        }
        else {
          $("#clipping-src-url").text("(None)");
        }
      }
      this._dismissSrcURLEditMode();
    });
  },

  cancelEdit: function ()
  {
    this._dismissSrcURLEditMode();
  },

  // Helper
  _dismissSrcURLEditMode: function ()
  {
    $("#src-url-normal-mode").show();
    $("#src-url-edit-mode").hide();
    $("#clipping-src-url-edit").val("");
  }
};


// Shortcut key editing
let gShortcutKey = {
  _oldKey:   "",
  _oldIndex: -1,

  init: function ()
  {
    $("#clipping-key").change(aEvent => {
      this.update();
    }).mousedown(aEvent => {
      this.setPrevShortcutKey();
    });
  },

  getPrevSelectedIndex: function ()
  {
    return this._oldIndex;
  },
  
  setPrevShortcutKey: function ()
  {
    let selectedNode = getClippingsTree().getActiveNode();
    if (! selectedNode) {
      return;
    }

    let clippingID = parseInt(selectedNode.key);
    this._oldIndex = $("#clipping-key")[0].selectedIndex;

    gClippingsDB.clippings.get(clippingID).then(aClipping => {
      this._oldKey = aClipping.shortcutKey;
    });
  },

  update: function ()
  {
    let shortcutKey = "";
    let shortcutKeyMenu = $("#clipping-key")[0];

    if (shortcutKeyMenu.selectedIndex == 0) {
      if (! this._oldKey) {
	// Skip shortcut key update if none was ever defined.
	return;
      }
    }
    else {
      shortcutKey = shortcutKeyMenu.options[shortcutKeyMenu.selectedIndex].text;
    }

    if (shortcutKey == this._oldKey) {
      return;
    }

    // Check if the shortcut key is already assigned.
    let assignedKeysLookup = {};
    gClippingsDB.clippings.where("shortcutKey").notEqual("").each((aItem, aCursor) => {
      assignedKeysLookup[aItem.shortcutKey] = 1;
    }).then(() => {
      if (assignedKeysLookup[shortcutKey]) {
        gDialogs.shctKeyConflict.showModal();
        return;
      }

      let selectedNode = getClippingsTree().getActiveNode();
      if (! selectedNode) {
        throw new Error("Can't set shortcut key if there is no clipping selected.");
      }

      let clippingID = parseInt(selectedNode.key);
      gClippingsDB.clippings.update(clippingID, { shortcutKey });
    }).catch (aErr => {
      console.error(aErr);
    });
  }
};


// Clippings Manager commands
let gCmd = {
  // Flags for undoStack actions
  ACTION_EDITNAME: 1,
  ACTION_EDITTEXT: 2,
  ACTION_DELETECLIPPING: 3,
  ACTION_CREATENEW: 4,
  ACTION_CHANGEPOSITION: 5,
  ACTION_CREATENEWFOLDER: 6,
  ACTION_DELETEFOLDER: 7,
  ACTION_MOVETOFOLDER: 8,
  ACTION_COPYTOFOLDER: 9,
  ACTION_DELETEEMPTYFOLDER: 10,
  ACTION_SETSHORTCUTKEY: 11,
  ACTION_SETLABEL: 12,

  // flags for aDestUndoStack parameter of functions for reversible actions
  UNDO_STACK: 1,
  REDO_STACK: 2,

  // Differentiate between clippings and folders, since they can have the same
  // ID in the database.
  ITEMTYPE_CLIPPING: 1,
  ITEMTYPE_FOLDER: 2,

  undoStack: {
    length: 0,
    _stack: [],

    push: function (aState) {
      this._stack.push(aState);
      this.length++;
    },

    pop: function () {
      var rv = this._stack.pop();
      this.length--;
      return rv;
    }
  },

  
  newClipping: function (aDestUndoStack)
  {
    if (gIsClippingsTreeEmpty) {
      unsetEmptyClippingsState();
    }
    
    let tree = getClippingsTree();
    let selectedNode = tree.activeNode;
    let parentFolderID = aeConst.ROOT_FOLDER_ID;
    
    if (selectedNode) {
      parentFolderID = this._getParentFldrIDOfTreeNode(selectedNode);
    }

    let createClipping = gClippingsDB.clippings.add({
      name: DEFAULT_NEW_CLIPPING_NAME,
      content: "",
      shortcutKey: "",
      parentFolderID: parentFolderID,
      label: "",
      sourceURL: ""
    });

    createClipping.then(aNewClippingID => {
      if (aDestUndoStack == this.UNDO_STACK) {
        this.undoStack.push({
          action: this.ACTION_CREATENEW,
          id: aNewClippingID,
          itemType: this.ITEMTYPE_CLIPPING
        });
      }
    });
  },

  newFolder: function (aDestUndoStack)
  {
    if (gIsClippingsTreeEmpty) {
      unsetEmptyClippingsState();
    }

    let tree = getClippingsTree();
    let selectedNode = tree.activeNode;
    let parentFolderID = aeConst.ROOT_FOLDER_ID;
    
    if (selectedNode) {
      parentFolderID = this._getParentFldrIDOfTreeNode(selectedNode);
    }
    
    let createFolder = gClippingsDB.folders.add({
      name: DEFAULT_NEW_FOLDER_NAME,
      parentFolderID: parentFolderID
    });

    createFolder.then(aNewFolderID => {
      if (aDestUndoStack == this.UNDO_STACK) {
        this.undoStack.push({
          action: this.ACTION_CREATENEWFOLDER,
          id: aNewFolderID,
          itemType: this.ITEMTYPE_FOLDER
        });
      }
    });
  },

  deleteClippingOrFolder: function (aDestUndoStack)
  {
    if (gIsClippingsTreeEmpty) {
      return;
    }

    let tree = getClippingsTree();
    let selectedNode = tree.activeNode;
    if (! selectedNode) {
      return;
    }

    let id = parseInt(selectedNode.key);
    let parentFolderID = this._getParentFldrIDOfTreeNode(selectedNode);
    
    if (selectedNode.isFolder()) {
      gClippingsDB.folders.update(id, { parentFolderID: aeConst.DELETED_ITEMS_FLDR_ID }).then(aNumUpd => {
        if (aDestUndoStack == this.UNDO_STACK) {
          this.undoStack.push({
            action: this.ACTION_DELETEFOLDER,
            itemType: this.ITEMTYPE_FOLDER,
            id,
            parentFolderID
          });
        }
      });
    }
    else {
      gClippingsDB.clippings.update(id, {
        parentFolderID: aeConst.DELETED_ITEMS_FLDR_ID,
        shortcutKey: ""
      }).then(aNumUpd => {
        if (aDestUndoStack == this.UNDO_STACK) {
          this.undoStack.push({
            action: this.ACTION_DELETECLIPPING,
            itemType: this.ITEMTYPE_CLIPPING,
            id,
            parentFolderID
          });
        }
      });
    }
  },

  // Internal commands are NOT meant to be invoked directly from the UI.
  moveClippingIntrl: function (aClippingID, aNewParentFldrID, aDestUndoStack)
  {
    if (gIsClippingsTreeEmpty) {
      unsetEmptyClippingsState();
    }

    let id, oldParentFldrID;
    
    gClippingsDB.clippings.get(aClippingID).then(aClipping => {
      oldParentFldrID = aClipping.parentFolderID;
      return gClippingsDB.clippings.update(aClippingID, { parentFolderID: aNewParentFldrID });
    }).then(aNumUpd => {
      if (aDestUndoStack == this.UNDO_STACK) {
        this.undoStack.push({
          action: this.ACTION_MOVETOFOLDER,
          itemType: this.ITEMTYPE_CLIPPING,
          id: aClippingID,
          oldParentFldrID,
          newParentFldrID: aNewParentFldrID
        });
      }
    }).catch(aErr => { console.error(aErr) });
  },

  moveFolderIntrl: function (aFolderID, aNewParentFldrID, aDestUndoStack)
  {
    if (gIsClippingsTreeEmpty) {
      unsetEmptyClippingsState();
    }

    let oldParentFldrID;
    
    gClippingsDB.folders.get(aFolderID).then(aFolder => {
      oldParentFldrID = aFolder.parentFolderID;
      return gClippingsDB.folders.update(aFolderID, { parentFolderID: aNewParentFldrID });
    }).then(aNumUpd => {
      if (aDestUndoStack == this.UNDO_STACK) {
        this.undoStack.push({
          action: this.ACTION_MOVETOFOLDER,
          itemType: this.ITEMTYPE_FOLDER,
          id: aFolderID,
          oldParentFldrID,
          newParentFldrID: aNewParentFldrID
        });
      }
    }).catch(aErr => { console.error(aErr) });
  },

  importFromFile: function ()
  {
    gDialogs.importFromFile.showModal();
  },

  exportToFile: function ()
  {
    gDialogs.exportToFile.showModal();
  },

  undo: function ()
  {
    if (this.undoStack.length == 0) {
      setStatusBarMsg("Nothing to undo");
      return;
    }

    let undo = this.undoStack.pop();

    if (undo.action == this.ACTION_DELETECLIPPING) {
      this.moveClippingIntrl(undo.id, undo.parentFolderID);
    }
    else if (undo.action == this.ACTION_DELETEFOLDER) {
      this.moveFolderIntrl(undo.id, undo.parentFolderID);
    }
    else if (undo.action == this.ACTION_MOVETOFOLDER) {
      if (undo.itemType == this.ITEMTYPE_CLIPPING) {
        this.moveClippingIntrl(undo.id, undo.oldParentFldrID);
      }
      else if (undo.itemType == this.ITEMTYPE_FOLDER) {
        this.moveFolderIntrl(undo.id, undo.oldParentFldrID);
      }
    }
    else if (undo.action == this.ACTION_CREATENEW) {
      this.moveClippingIntrl(undo.id, aeConst.DELETED_ITEMS_FLDR_ID);
    }
    else if (undo.action == this.ACTION_CREATENEWFOLDER) {
      this.moveFolderIntrl(undo.id, aeConst.DELETED_ITEMS_FLDR_ID);
    }
  },
  
  // Helper
  _getParentFldrIDOfTreeNode: function (aNode)
  {
    let rv = null;
    let parentNode = aNode.getParent();
    rv = (parentNode.isRootNode() ? aeConst.ROOT_FOLDER_ID : parseInt(parentNode.key));

    return rv;
  }
};


// Initializing Clippings Manager window
$(document).ready(() => {
  gClippings = chrome.extension.getBackgroundPage();

  if (gClippings) {
    gClippingsDB = gClippings.getClippingsDB();
    log("Clippings/wx: clippingsMgr: Successfully opened Clippings DB");
  }
  else {
    showBanner("Error initializing Clippings Manager: Unable to locate parent browser window.");
  }

  chrome.runtime.getPlatformInfo(aInfo => { gOS = aInfo.os; });

  let clippingsListeners = gClippings.getClippingsListeners();
  gClippingsListener.origin = clippingsListeners.ORIGIN_CLIPPINGS_MGR;
  clippingsListeners.add(gClippingsListener);

  initToolbarButtons();
  initInstantEditing();
  gShortcutKey.init();
  gSrcURLBar.init();
  initLabelPicker();
  initDialogs();
  buildClippingsTree();

  $("#search-box").focus(aEvent => {
    gSearchBox.init();
    gSearchBox.activate();
  });
  
  chrome.history.deleteUrl({ url: window.location.href });
});


// Reloading or closing Clippings Manager window
$(window).on("beforeunload", () => {
  if (! gIsReloading) {
    browser.runtime.sendMessage({ msgID: "close-clippings-mgr-wnd" });
  }
  
  let clippingsListeners = gClippings.getClippingsListeners();
  clippingsListeners.remove(gClippingsListener);

  purgeDeletedItems(aeConst.DELETED_ITEMS_FLDR_ID);
});


// Keyboard event handler
$(document).keypress(aEvent => {
  const isMacOS = gClippings.getOS() == "mac";

  function isAccelKeyPressed()
  {
    if (isMacOS) {
      return aEvent.metaKey;
    }
    return aEvent.ctrlKey;
  }

  // NOTE: CTRL+W/Cmd+W is automatically handled, so no need to define it here.
  if (aEvent.key == "F1") {
    window.alert("No help is available (so leave me alone)");
  }
  else if (aEvent.key == "Enter") {
    // TO DO: Invoke accept action on any open modal dialogs.
  }
  else if (aEvent.key == "Escape") {
    if (gSearchBox.isActivated()) {
      gSearchBox.reset();
    }
    // TO DO: Invoke cancel on any open modal dialogs.
  }
  else if (aEvent.key == "Delete") {
    gCmd.deleteClippingOrFolder(gCmd.UNDO_STACK);
  }
  else if (aEvent.key.toUpperCase() == "F" && isAccelKeyPressed()) {
    aEvent.preventDefault();
    $("#search-box").focus();
  }
  else if (aEvent.key.toUpperCase() == "Z" && isAccelKeyPressed()) {
    gCmd.undo();
  }
});


//
// Clippings Manager functions
//

function initToolbarButtons()
{
  $("#new-clipping").click(aEvent => { gCmd.newClipping(gCmd.UNDO_STACK) });
  $("#new-folder").click(aEvent => { gCmd.newFolder(gCmd.UNDO_STACK) });

  // TEMPORARY
  $("#move").css({ display: "none" });
  // END TEMPORARY
  
  $("#delete").click(aEvent => {
    gCmd.deleteClippingOrFolder(gCmd.UNDO_STACK)
  });

  $("#undo").click(aEvent => { gCmd.undo() });

  // Tools menu
  $.contextMenu({
    selector: "#clippings-mgr-options",
    trigger: "left",
    callback: function (aItemKey, aOpt, aRootMenu, aOriginalEvent) {
      switch (aItemKey) {
      case "importFromFile":
        gCmd.importFromFile();
        break;

      case "exportToFile":
        gCmd.exportToFile();
        break;

      default:
        window.alert("The selected action is not available right now.");
        break;
      }
    },
    items: {
      backup: {
        name: "Backup...",
        className: "ae-menuitem"
      },
      restoreFromBkup: {
        name: "Restore...",
        className: "ae-menuitem"
      },
      separator1: "--------",
      importFromFile: {
        name: "Import...",
        className: "ae-menuitem"
      },
      exportToFile: {
        name: "Export...",
        className: "ae-menuitem"
      },
      separator2: "--------",
      removeAllSrcURLs: {
        name: "Remove Source Web Addresses...",
        className: "ae-menuitem"
      },
    }
  });
}


function initInstantEditing()
{
  $("#clipping-name").blur(aEvent => {
    log("Clippings/wx::clippingsMgr.js: Blur event fired on clipping name textbox");
    let tree = getClippingsTree();
    let selectedNode = tree.activeNode;
    let name = aEvent.target.value;
    let id = parseInt(selectedNode.key);

    if (selectedNode.isFolder()) {
      name = (name ? name : DEFAULT_UNTITLED_FOLDER_NAME);
      gClippingsDB.folders.update(id, { name });
    }
    else {
      name = (name ? name : DEFAULT_UNTITLED_CLIPPING_NAME);
      gClippingsDB.clippings.update(id, { name });
    }
  });
  
  $("#clipping-text").blur(aEvent => {
    log("Clippings/wx::clippingsMgr.js: Blur event fired on clipping content text area");
    let tree = getClippingsTree();
    let selectedNode = tree.activeNode;
    let id = parseInt(selectedNode.key);

    if (! selectedNode.folder) {
      let text = aEvent.target.value;
      gClippingsDB.clippings.update(id, { content: text });
    }
  });
}


function initDialogs()
{
  aeImportExport.setDatabase(gClippingsDB);

  gDialogs.shctKeyConflict = new aeDialog("shortcut-key-conflict-msgbox");
  gDialogs.shctKeyConflict.setAccept(aEvent => {
    gDialogs.shctKeyConflict.close();

    // NOTE: As of Firefox 57b8, this doesn't do anything.
    $("#clipping-key")[0].selectedIndex = gShortcutKey.getPrevSelectedIndex();
  });

  gDialogs.importFromFile = new aeDialog("import-dlg");
  gDialogs.importFromFile.setInit(() => {
    $("#import-clippings-file-upload").on("change", aEvent => {
      $("#import-error").text("").hide();
      if (aEvent.target.files.length > 0) {
        $("#import-dlg button.dlg-accept").removeAttr("disabled");
      }
    });
  });
  gDialogs.importFromFile.setUnload(() => {
    $("#import-error").text("").hide();
    $("#import-dlg #import-clippings-file-upload").val("");
    $("#import-clippings-replc-shct-keys")[0].checked = true;
  });
  gDialogs.importFromFile.setCancel();
  gDialogs.importFromFile.setAccept(aEvent => {
    function uploadImportFile(aFileList) {
      if (aFileList.length == 0) {
        return;
      }
      
      let importFile = aFileList[0];
      console.log("Clippings Manager: Selected import file: '%s'\nFile size: %d bytes", importFile.name, importFile.size);

      let fileReader = new FileReader();
      fileReader.addEventListener("load", aEvent => {
        let rawData = aEvent.target.result;
        let replaceShortcutKeys = ($("#import-clippings-replc-shct-keys:checked").length > 0);
        
        try {
          if (importFile.name.endsWith(".json")) {
            aeImportExport.importFromJSON(rawData, replaceShortcutKeys);
          }
          else if (importFile.name.endsWith(".rdf")) {
            aeImportExport.importFromRDF(rawData, replaceShortcutKeys);
          }
        }
        catch (e) {
          $("#import-progress-bar").hide();
          console.error(e);
          $("#import-error").text("Error reading selected file.  The file may not be a valid Clippings file.").show();
          return;
        }

        $("#import-error").text("").hide();
        $("#import-progress-bar").hide();
        gDialogs.importFromFile.close();
      });

      fileReader.readAsText(importFile);
    }

    $("#import-progress-bar").show();

    let inputFileElt = $("#import-clippings-file-upload")[0];
    uploadImportFile(inputFileElt.files);
  });

  gDialogs.exportToFile = new aeDialog("export-dlg");
  gDialogs.exportToFile.setInit(() => {
    let fmtDesc = [
      "The default format for backing up and exchanging Clippings data with other users or multiple computers.  Requires Clippings 5.5 or newer installed.",
      "Exports your Clippings data as an HTML document for printing or display in a web browser."
    ];
    
    $("#export-format-list").change(aEvent => {
      let selectedFmtIdx = aEvent.target.selectedIndex;
      $("#format-description").text(fmtDesc[selectedFmtIdx]);

      if (selectedFmtIdx == 0) { // Clippings 6
        $("#include-src-urls").removeAttr("disabled");
      }
      else if (selectedFmtIdx == 1) {  // HTML Document
        $("#include-src-urls").attr("disabled", "true").prop("checked", false);
      }
    });

    $("#export-format-list")[0].selectedIndex = 0;
    $("#format-description").text(fmtDesc[0]);
    $("#include-src-urls").prop("checked", true);
  });
  gDialogs.exportToFile.setCancel();
  gDialogs.exportToFile.setAccept();
  gDialogs.exportToFile.setAfterAccept(() => {
    function saveToFile(aBlobData, aFilename)
    {
      browser.downloads.download({
        url: URL.createObjectURL(aBlobData),
        filename: aFilename,
        saveAs: true
      }).then(aDownldItemID => {
        setStatusBarMsg("Exporting... done");
      }).catch(aErr => {
        if (aErr.fileName == "undefined") {
          setStatusBarMsg();
        }
        else {
          console.error(aErr);
          window.alert("Export failed.\n" + aErr);
        }
      });
    }
    
    let selectedFmtIdx = $("#export-format-list")[0].selectedIndex;
    setStatusBarMsg("Exporting...");
    
    if (selectedFmtIdx == 0) {  // Clippings 6
      let inclSrcURLs = $("#include-src-urls").prop("checked");

      aeImportExport.exportToJSON(inclSrcURLs).then(aJSONData => {
        let blobData = new Blob([aJSONData], { type: "application/json;charset=utf-8"});

        saveToFile(blobData, aeConst.CLIPPINGS_EXPORT_FILENAME);
      });
    }
    else if (selectedFmtIdx == 1) {  // HTML Document
      aeImportExport.exportToHTML().then(aHTMLData => {
        // TEMPORARY
        console.log("HTML export: ");
        console.log(aHTMLData);
        return;
        // END TEMPORARY
        
        let blobData = new Blob([aHTMLData], { type: "text/html;charset=utf-8"});
        saveToFile(blobData, aeConst.HTML_EXPORT_FILENAME);
      });
    }
  });
}


function getClippingsTree()
{
  let rv = $("#clippings-tree").fancytree("getTree");
  return rv;
}


function buildClippingsTree()
{
  let treeData = [];

  gClippingsDB.transaction("r", gClippingsDB.folders, gClippingsDB.clippings, () => {
    gClippingsDB.folders.where("parentFolderID").equals(aeConst.ROOT_FOLDER_ID).each((aItem, aCursor) => {
      let folderNode = {
        key: aItem.id + "F",
        title: sanitizeTreeNodeTitle(DEBUG_TREE ? `${aItem.name} [key=${aItem.id}F]` : aItem.name),
        folder: true
      };

      let childNodes = buildClippingsTreeHelper(aeConst.ROOT_FOLDER_ID, aItem);
      folderNode.children = childNodes;

      treeData.push(folderNode);
    }).then(() => {
      return gClippingsDB.clippings.where("parentFolderID").equals(aeConst.ROOT_FOLDER_ID).each((aItem, aCursor) => {
        let clippingNode = {
          key: aItem.id + "C",
          title: sanitizeTreeNodeTitle(DEBUG_TREE ? `${aItem.name} [key=${aItem.id}C]` : aItem.name)
        };

        if (aItem.label) {
          clippingNode.extraClasses = `ae-clipping-label-${aItem.label}`;
        }

        treeData.push(clippingNode);
      });
    }).then(() => {
      if (treeData.length == 0) {
        treeData = setEmptyClippingsState();
      }
      
      $("#clippings-tree").fancytree({
        extensions: ["dnd5", "filter"],
        
        autoScroll: true,
        source: treeData,
        selectMode: 1,
        icon: (gIsClippingsTreeEmpty ? false : true),

        init: function (aEvent, aData) {
          let rootNode = aData.tree.getRootNode();
          if (rootNode.children.length > 0 && !gIsClippingsTreeEmpty) {
            rootNode.children[0].setActive();
          }
        },

        activate: function (aEvent, aData) {
          log("Clippings/wx::clippingsMgr.js: Activate event fired on clippings tree");
          updateDisplay(aEvent, aData);
        },

        dnd5: {
          preventRecursiveMoves: true,
          preventVoidMoves: true,
          scroll: true,

          dragStart: function (aNode, aData) {
            return true;
          },

          dragEnter: function (aNode, aData) {
            aData.dataTransfer.dropEffect = "move";
            return true;
          },

          dragDrop: function (aNode, aData) {
            if (aData.otherNode) {
              // Prevent dropping a node into a non-folder node.
              if (!aNode.isFolder() && aData.hitMode == "over") {
                return;
              }

              let parentNode = aNode.getParent();
              let newParentID = aeConst.ROOT_FOLDER_ID;
              
              if (aNode.isFolder() && aData.hitMode == "over") {
                newParentID = parseInt(aNode.key);
              }
              else {
                newParentID = (parentNode.isRootNode() ? aeConst.ROOT_FOLDER_ID : parseInt(parentNode.key));
              }

              aData.otherNode.moveTo(aNode, aData.hitMode);
              gClippingsTreeDnD = true;
              
              let id = parseInt(aData.otherNode.key);
              log(`Clippings/wx: clippingsMgr.js::#clippings-tree.dnd5.dragDrop(): ID of moved clipping or folder: ${id}\nID of new parent folder: ${newParentID}`);

              if (aData.otherNode.isFolder()) {
                gCmd.moveFolderIntrl(id, newParentID, gCmd.UNDO_STACK);
              }
              else {
                gCmd.moveClippingIntrl(id, newParentID, gCmd.UNDO_STACK);
              }
            }
            else {
              // Drop a non-node
              let dndData = aData.dataTransfer.getData("text");
              parentNode.addNode({ title: dndData }, aData.hitMode);

              // TO DO: Create the clipping in the database.
            }
            aNode.setExpanded();
          }
        },

        filter: {
          autoExpand: true,
          counter: false,
          highlight: true,
          mode: "hide"
        }
      });

      setStatusBarMsg(gIsClippingsTreeEmpty ? "0 items" : null);
    });
  }).catch(aErr => {
    console.error("Clippings/wx::buildContextMenu(): %s", aErr.message);
  });
}


function buildClippingsTreeHelper(aParentFolderID, aFolderData)
{
  let rv = [];
  let fldrID = aFolderData.id;

  gClippingsDB.transaction("r", gClippingsDB.folders, gClippingsDB.clippings, () => {
    gClippingsDB.folders.where("parentFolderID").equals(fldrID).each((aItem, aCursor) => {
      let folderNode = {
        key: aItem.id + "F",
        title: sanitizeTreeNodeTitle(DEBUG_TREE ? `${aItem.name} [key=${aItem.id}F]` : aItem.name),
        folder: true
      }
      let childNodes = buildClippingsTreeHelper(fldrID, aItem);
      folderNode.children = childNodes;

      rv.push(folderNode);
    }).then(() => {
      gClippingsDB.clippings.where("parentFolderID").equals(fldrID).each((aItem, aCursor) => {
        let clippingNode = {
          key: aItem.id + "C",
          title: sanitizeTreeNodeTitle(DEBUG_TREE ? `${aItem.name} [key=${aItem.id}C]` : aItem.name)
        };
        if (aItem.label) {
          clippingNode.extraClasses = `ae-clipping-label-${aItem.label}`;
        }

        rv.push(clippingNode);
      });
    });
  }).catch(aErr => {
    console.error("Clippings/wx::clippingsMgr.js::buildClippingsTreeHelper(): %s", aErr.message);
  });

  return rv;
}


function setEmptyClippingsState()
{
  var rv;
  rv = [{ title: "No clippings found.", key: "0" }];
  gIsClippingsTreeEmpty = true;
  $("#clipping-name, #clipping-text, #source-url-bar, #options-bar").hide();
  
  return rv;
}


function unsetEmptyClippingsState()
{
  let tree = getClippingsTree();
  let emptyMsgNode = tree.getNodeByKey("0");
  emptyMsgNode.remove();
  tree.options.icon = true;
  gIsClippingsTreeEmpty = false;
  $("#clipping-name, #clipping-text, #options-bar").show();
}


function sanitizeTreeNodeTitle(aNodeTitle)
{
  let rv = "";
  rv = aNodeTitle.replace(/</g, "&lt;");
  rv = rv.replace(/>/g, "&gt;");
  
  return rv;
}


function initShortcutKeyMenu()
{
  $("#clipping-key").change(aEvent => {
    let shortcutKeyMenu = aEvent.target;
    let shortcutKey = "";
    
    if (shortcutKeyMenu.selectedIndex != 0) {
      shortcutKey = shortcutKeyMenu.options[shortcutKeyMenu.selectedIndex].text;
    }

    // Check if the shortcut key is already assigned.
    let assignedKeysLookup = {};
    gClippingsDB.clippings.where("shortcutKey").notEqual("").each((aItem, aCursor) => {
      assignedKeysLookup[aItem.shortcutKey] = 1;
    }).then(() => {
      if (assignedKeysLookup[shortcutKey]) {
        gDialogs.shctKeyConflict.showModal();
        return;
      }

      let selectedNode = getClippingsTree().getActiveNode();
      if (! selectedNode) {
        console.warn("Can't set shortcut key if there is no clipping selected.");
        return;
      }

      let clippingID = parseInt(selectedNode.key);
      gClippingsDB.clippings.update(clippingID, { shortcutKey });
    });
  });
}


function initLabelPicker()
{
  $("#tmp-clipping-label").hide();
}


function updateDisplay(aEvent, aData)
{
  if (gIsClippingsTreeEmpty) {
    $("#source-url-bar, #options-bar").hide();
    setStatusBarMsg("0 items");
    return;
  }

  log("Clippings/wx: clippingsMgr: Updating display...");

  if (gSearchBox.isActivated()) {
    gSearchBox.updateSearch();
    let numMatches = gSearchBox.getCountMatches();
    setStatusBarMsg(`${numMatches} matches`);
  }
  else {
    setStatusBarMsg();
  }

  if (gSrcURLBar.isEditing()) {
    gSrcURLBar.cancelEdit();
  }
  
  let selectedItemID = parseInt(aData.node.key);

  if (aData.node.isFolder()) {
    let getFolder = gClippingsDB.folders.get(selectedItemID);
    getFolder.then(aResult => {
      $("#clipping-name").val(aResult.name);
      $("#clipping-text").val("").hide();

      $("#source-url-bar, #options-bar").hide();
      $("#clipping-src-url").text("");
      let shortcutKeyMenu = $("#clipping-key")[0];
      shortcutKeyMenu.selectedIndex = 0;
    });
  }
  else {
    let getClipping = gClippingsDB.clippings.get(selectedItemID);
    getClipping.then(aResult => {
      $("#clipping-name").val(aResult.name);
      $("#clipping-text").val(aResult.content).show();
      $("#source-url-bar, #options-bar").show();
      
      if (aResult.sourceURL) {
        $("#clipping-src-url").html(`<a href="${aResult.sourceURL}">${aResult.sourceURL}</a>`);
        $("#clipping-src-url > a").click(aEvent => {
          aEvent.preventDefault();
          chrome.windows.create({
            url: aEvent.target.textContent,
            type: "normal",
            state: "normal"
          });
        });
      }
      else {
        $("#clipping-src-url").text("(None)");
      }
      
      let shortcutKeyMenu = $("#clipping-key")[0];
      shortcutKeyMenu.selectedIndex = 0;
      
      for (let i = 0; i < shortcutKeyMenu.options.length; i++) {
        if (shortcutKeyMenu[i].text == aResult.shortcutKey) {
          shortcutKeyMenu.selectedIndex = i;
          break;
        }
      }

      if (aResult.label) {
        let color = "white";
        if (aResult.label.toLowerCase() == "yellow") {
          color = "black";
        }
        $("#tmp-label").css({ color, backgroundColor: aResult.label });
        $("#tmp-label").text(aResult.label.toLowerCase());
        $("#tmp-clipping-label").show();
      }
      else {
        $("#tmp-label").text("");
        $("#tmp-clipping-label").hide();
      }
    });
  }
}


function setStatusBarMsg(aMessage)
{
  if (aMessage) {
    $("#status-bar-msg").text(aMessage);
    return;
  }

  let tree = getClippingsTree();
  $("#status-bar-msg").text(`${tree.count()} items`);
}


function purgeDeletedItems(aFolderID)
{
  gClippingsDB.transaction("rw", gClippingsDB.clippings, gClippingsDB.folders, () => {
    gClippingsDB.folders.where("parentFolderID").equals(aFolderID).each((aItem, aCursor) => {
      purgeDeletedItems(aItem.id);
    }).then(() => {
      if (aFolderID != aeConst.DELETED_ITEMS_FLDR_ID) {
        gClippingsDB.folders.delete(aFolderID);
      }

      gClippingsDB.clippings.where("parentFolderID").equals(aFolderID).each((aItem, aCursor) => {
        gClippingsDB.clippings.delete(aItem.id);
      });
    });
  }).catch(aErr => {
    console.error(aErr);
  });
}


function showBanner(aMessage)
{
  let bannerElt = $("#banner");
  let bannerMsgElt = $("#banner-msg");

  bannerMsgElt.children().remove();
  bannerMsgElt.text(aMessage);
  bannerElt.css("display", "block");
}


function onError(aError)
{
  showBanner(aError.message);

  if (aeConst.DEBUG) {
    console.error(aError.message);
  }
}


function log(aMessage)
{
  if (aeConst.DEBUG) { console.log(aMessage); }
}


function info(aMessage)
{
  if (aeConst.DEBUG) { console.info(aMessage); }
}


function warn(aMessage)
{
  if (aeConst.DEBUG) { console.warn(aMessage); }
}
