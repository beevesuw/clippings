/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


class aeDialog
{
  constructor(aDlgEltSelector)
  {
    this._dlgEltStor = aDlgEltSelector;
    this._fnInit = function () {};
    this._fnUnload = function () {};
    this._fnAfterDlgAccept = function () {};

    this._fnDlgAccept = function (aEvent) {
      this.close();
    };
    
    this._fnDlgCancel = function (aEvent) {
      this.close();
    };

    this._init();
  }

  _init()
  {
    let dlgAcceptElt = $(`${this._dlgEltStor} > .dlg-btns > .dlg-accept`);
    if (dlgAcceptElt.length > 0) {
      dlgAcceptElt.click(aEvent => {
        if (aEvent.target.disabled) {
          return;
        }
        this._fnDlgAccept(aEvent);
        this._fnAfterDlgAccept();
      });
    }

    let dlgCancelElt = $(`${this._dlgEltStor} > .dlg-btns > .dlg-cancel`);
    if (dlgCancelElt.length > 0) {
      dlgCancelElt.click(aEvent => {
        if (aEvent.target.disabled) {
          return;
        }
        this._fnDlgCancel(aEvent);
      });
    }
  }
  
  setInit(aFnInit)
  {
    this._fnInit = aFnInit;
  }

  setUnload(aFnUnload)
  {
    this._fnUnload = aFnUnload;
  }

  setAfterAccept(aFnAfterAccept)
  {
    this._fnAfterDlgAccept = aFnAfterAccept;
  }
  
  setAccept(aFnAccept)
  {
    this._fnDlgAccept = aFnAccept;
  }

  setCancel(aFnCancel)
  {
    this._fnDlgCancel = aFnCancel;    
  }

  showModal()
  {
    this._fnInit();
    $("#lightbox-bkgrd-ovl").addClass("lightbox-show");
    $(`${this._dlgEltStor}`).addClass("lightbox-show");
  }

  close()
  {
    this._fnUnload();
    $(`${this._dlgEltStor}`).removeClass("lightbox-show");
    $("#lightbox-bkgrd-ovl").removeClass("lightbox-show");
  }

  static isOpen()
  {
    return ($(".lightbox-show").length > 0);
  }
  
  static acceptDlgs()
  {
    let openDlgElts = $(".lightbox-show");

    if (openDlgElts.length > 0) {
      // Normally there should just be 1 dialog open at a time.
      $(".lightbox-show .dlg-accept:not(:disabled)").click();
    }
  }

  static cancelDlgs()
  {
    let openDlgElts = $(".lightbox-show");

    if (openDlgElts.length > 0) {
      $(".lightbox-show .dlg-cancel:not(:disabled)").click();
    }
  }
}
