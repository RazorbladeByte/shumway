/**
 * Copyright 2014 Mozilla Foundation
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 * http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// Class: Mouse
module Shumway.AVM2.AS.flash.ui {
  import notImplemented = Shumway.Debug.notImplemented;
  import asCoerceString = Shumway.AVM2.Runtime.asCoerceString;
  import InteractiveObject = flash.display.InteractiveObject;
  import Point = flash.geom.Point;

  /**
   * Dispatches AS3 mouse events.
   */
  export class MouseEventDispatcher {
    stage: flash.display.Stage;

    /**
     * Finds the interactive object on which the event is dispatched.
     */
    private _findTarget(e: MouseEvent, point: Point): InteractiveObject {
      var objects = this.stage.getObjectsUnderPoint(point);
      var target: InteractiveObject;
      for (var i = objects.length - 1; i >= 0; i--) {
        var object = objects[i];
        var interactiveObject;
        if (flash.display.InteractiveObject.isType(object)) {
          interactiveObject = <InteractiveObject>object;
        } else {
          // TODO: Not correct.
          interactiveObject = object._parent;
        }
        assert (interactiveObject);
        // TODO: This is probably broken because of depth order.
        var ancestor = interactiveObject.getOldestMouseChildrenAncestor();
        if (ancestor) {
          interactiveObject = ancestor;
        }
        // Interactive objects that have |mouseEnabled| set to |false| don't receive
        // mouse events, their children however are unaffected.
        if (interactiveObject.mouseEnabled) {
          target = interactiveObject;
          break;
        }
      }
      return target;
    }

    /**
     * Converts JS mouse events into AS3 mouse events.
     */
    public dispatchMouseEvent(e: MouseEvent, point: Point) {
      if (!this.stage) {
        return;
      }
      if (e.type !== "click") {
        return;
      }
      var target = this._findTarget(e, point);
      if (target) {
        // TODO: Create proper event objects.
        var event = new flash.events.MouseEvent (
          e.type
        );
        target.dispatchEvent(event);
      }
    }
  }

  export class Mouse extends ASNative {
    
    // Called whenever the class is initialized.
    static classInitializer: any = null;
    
    // Called whenever an instance of the class is initialized.
    static initializer: any = null;
    
    // List of static symbols to link.
    static classSymbols: string [] = null; // [];
    
    // List of instance symbols to link.
    static instanceSymbols: string [] = null; // [];
    
    constructor () {
      false && super();
      notImplemented("Dummy Constructor: public flash.ui.Mouse");
    }
    
    // JS -> AS Bindings
    
    
    // AS -> JS Bindings
    // static _supportsCursor: boolean;
    // static _cursor: string;
    // static _supportsNativeCursor: boolean;
    get supportsCursor(): boolean {
      notImplemented("public flash.ui.Mouse::get supportsCursor"); return;
      // return this._supportsCursor;
    }
    get cursor(): string {
      notImplemented("public flash.ui.Mouse::get cursor"); return;
      // return this._cursor;
    }
    set cursor(value: string) {
      value = asCoerceString(value);
      notImplemented("public flash.ui.Mouse::set cursor"); return;
      // this._cursor = value;
    }
    get supportsNativeCursor(): boolean {
      notImplemented("public flash.ui.Mouse::get supportsNativeCursor"); return;
      // return this._supportsNativeCursor;
    }
    static hide(): void {
      notImplemented("public flash.ui.Mouse::static hide"); return;
    }
    static show(): void {
      notImplemented("public flash.ui.Mouse::static show"); return;
    }
    static registerCursor(name: string, cursor: flash.ui.MouseCursorData): void {
      name = asCoerceString(name); cursor = cursor;
      notImplemented("public flash.ui.Mouse::static registerCursor"); return;
    }
    static unregisterCursor(name: string): void {
      name = asCoerceString(name);
      notImplemented("public flash.ui.Mouse::static unregisterCursor"); return;
    }

    private static _currentPosition: Point;

    public static set currentPosition(value: Point) {
      this._currentPosition = value;
    }

    public static get currentPosition(): Point {
      return this._currentPosition;
    }
  }
}
