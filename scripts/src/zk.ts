export { BoundElement, utils, zk };
export type { proxyObservable, SubModel };
import { ObservableObject, makeObservable } from "./ObservableObject";
/*
/*
Master list of binding syntax:

attr: <attr>|<valueObjet>|<formatCallback>
for: key of <iterable>
text: <object>
format: <object>|<callback> 
*/

type proxyObservable = any & {
  _observableObject: ObservableObject;
  _targetObject: any;
  $parentModel: any;
  $model: any;
};

type SubModel = {
  subModel: {};
  node: HTMLElement;
};

const zk = {
  root_model: {},
  makeObservable: makeObservable,
  initiateModel: initiateModel,
};

// Function to initiate any object variables accessible to all zk objects
// Then begin recursively parsing DOM for observable elements
// Parameters
// Model: an object containing observable objects
// Root: An html node that is the root element of all observable objects
function initiateModel(model: any, root: HTMLElement): void {
  for (let object in model) {
    if (!model[object]) {
      continue;
    }
    if (model[object]._observableObject) {
      model[object]._observableObject.$model = model;
    }
  }

  if (!(root instanceof HTMLElement)) {
    throw new Error(
      "Invalid argument: second parameter must be an HTML element"
    );
  }
  ParseDOMforObservables(model, root);
}
// Recursive function that locates and registers any html element descending from root that should be observed
export function ParseDOMforObservables(model: any, root: HTMLElement) {
  var isIndependentElement: boolean = false;

  // if HTML element contains binder
  if (root.getAttribute("zk-bind")) {
    // parse the bind command
    // bind syntax is '<bindMode>: <object path'
    const zkbind = root.getAttribute("zk-bind");

    var bindingExpressions: string[] = [];
    if (zkbind) {
      bindingExpressions = zkbind.split(";");
    }

    for (let binder of bindingExpressions) {
      const splitBinder = binder.split(":");

      if (splitBinder.length < 2) {
        throw new Error(`Invalid binding at: ${root}`);
      }

      // isolate bindMode string and object path (getting rid of preceding white space)
      const bindMode = splitBinder[0];
      const objectPath = splitBinder[1].trim();

      // Current array of valid bind modes for validity checking
      const validBindModes = [
        "text",
        "value",
        "for",
        "date",
        "on",
        "format",
        "checkbox",
        "attr",
        "hidden",
        "visible",
        "radio",
      ];

      // Verify that bind mode is valid
      if (!validBindModes.includes(bindMode)) {
        console.error(bindMode + " is not a valid bind mode");
        continue;
      }

      // Parent object in path is expected to be an attribute of the model parameter of this function
      // Parse parent object, and add this element to the appropriate list
      let parentObject = objectPath.split(".")[0];

      // A little messy, but 'for' binders receive an argument of 'indexKey of iterable' where
      // iterable is the typical objectpaty.
      if (bindMode === "for") {
        parentObject = objectPath.split("of")[1].trim().split(".")[0];
      }

      // Push the element to the appropriate list
      // Placeholder for bindmode until parsing occers.
      // TODO: make register element pass parsing to bound element rather than do it on the object itself.
      const boundElement = new BoundElement(root, objectPath, bindMode, "");

      if (bindMode === "on") {
        registerListener(boundElement, model);
        continue;
      }
      if (bindMode === "attr") {
        parentObject = objectPath.split("|")[1].split(".")[0];
      }

      if (
        typeof parentObject === "undefined" ||
        typeof model[parentObject] === "undefined"
      ) {
        console.error("Invald object path at ", binder, "with model: ", model);
        continue;
      }

      let observableTarget: ObservableObject;
      observableTarget = model[parentObject]._observableObject;
      if (!observableTarget) {
        console.warn(
          `attempting to bind on non-observable object at`,
          boundElement.DOMelement
        );
        if (bindMode === "value") {
          root.innerText = utils.returnTargetProperty(model, objectPath, false);
        }
        continue;
      }
      observableTarget.registerElement(bindMode, boundElement);

      // Some binders, such as 'for' binders, create a separate tree model for all of their children
      // This array contains a list of all 'uprooting' binders
      let uprootingBinders = ["for"];

      // This root becomes a new tree, so now further exploration of this branch can happen to avoid duplicate bindings
      if (uprootingBinders.includes(bindMode)) {
        isIndependentElement = true;
      }
    }
  }

  if (isIndependentElement) {
    return;
  }
  const children = root.children;

  // iterate through children
  for (let child of children) {
    if (child instanceof HTMLElement) {
      // Recursively parse all children of current root element
      ParseDOMforObservables(model, child);
    }
  }
}

// instantiates a bound element storing the DOM element and the object path to which it is linked
class BoundElement {
  DOMelement: HTMLElement;
  objectPath: string;
  bindMode: string;
  target: proxyObservable;
  property: string;
  observableChildren?: SubModel[];
  attr?: string;
  templateNode?: HTMLElement;
  iteratorKey?: string;
  updateCallback?: (arg: any) => void;
  valueList?: string[];
  constructor(
    DOMelement: HTMLElement,
    objectPath: string,
    bindMode: string,
    property: string
  ) {
    this.DOMelement = DOMelement;
    this.objectPath = objectPath;
    this.bindMode = bindMode;
    this.property = property;
  }
  update() {
    let value = this.target[this.property];

    if (this.updateCallback) {
      value = this.updateCallback(value);
      // TODO add configuration callbacks for date string formatting
    }
    switch (this.bindMode) {
      case "attr":
        if (!this.attr) {
          throw new Error("No attr value defined for bound element");
        }
        this.DOMelement.setAttribute(this.attr, value);
        return;
    }

    this.DOMelement.innerText = value;
  }
}

// 'on' binds have an object path of <event>|<callback>
function registerListener(boundElement: BoundElement, model: any) {
  // Locate split end parentheses off
  let eventType: string, methodSignature: string;
  [eventType, methodSignature] = boundElement.objectPath.split("|");
  const methodName = methodSignature.split("(")[0];
  const parameters = methodSignature.split("(")[1].split(")")[0];
  const argArray: any[] = [];
  for (let key of parameters.split(",")) {
    argArray.push(model[key]);
  }
  try {
    let callbackParent = utils.returnTargetProperty(model, methodName, true);

    let callback = utils.returnTargetProperty(model, methodName);
    if (!callback) {
      throw new Error(
        "callback not found at " + methodSignature + "in model: " + model
      );
    }
    boundElement.DOMelement.addEventListener(eventType, function () {
      callback.apply(callbackParent, argArray);
    });
  } catch (err) {
    console.error(`${err.name}: ${err.message}`);
  }
}

let utils = {
  deepClone: function deepClone(object: any) {
    var newObject: any = {};
    if (Array.isArray(object)) {
      let newArray = [];
      for (let item of object) {
        let cloneItem = deepClone(item);
        newArray.push(cloneItem);
      }

      if (typeof object != "object") {
        return object;
      }
    }
    for (let property in object) {
      newObject[property] = deepClone(object[property]);
    }
    return newObject;
  },
  deepProxy: function deepProxy(
    object: any,
    handler: ProxyHandler<any>
  ): proxyObservable {
    // do not remake observable objects
    if (typeof object === "function") {
      return new Proxy(object, handler);
    }
    if (Array.isArray(object)) {
      for (let i = 0; i < object.length; i++) {
        object[i] = deepProxy(object[i], handler);
      }
      object = new Proxy(object, handler);
      return object;
    }
    for (let item in object) {
      if (typeof object[item] === "object") {
        object[item] = deepProxy(object[item], handler);
      }
    }

    if (typeof object === "object" && object) {
      return new Proxy(object, handler);
    }
    return object;
  },
  // method to remove first and last object for oRef attribut
  prepareObjectPath: function (objectPath: any) {
    let objArray = objectPath.split(".");
    let property = objArray[objArray.length - 1];
    objArray = objArray.splice(1);
    objArray = objArray.join(".");
    return objArray;
  },
  // generalizing the method to access object property using string path such as "person.task.dueDate"
  returnTargetProperty: function returnTargetProperty(
    objectTarget: any,
    pathToObject: string,
    getParent?: any
  ) {
    let targetChild = objectTarget;
    let splitPath = pathToObject.split(".");

    let i = 0;
    if (splitPath[0] === "root") {
      targetChild = zk.root_model;
      i++;
    }

    while (i < splitPath.length) {
      if (getParent && i === splitPath.length - 1) {
        return targetChild;
      }
      targetChild = targetChild[splitPath[i]];
      if (!targetChild) {
        throw new Error(pathToObject + " is an invalid property path");
      }
      i++;
    }

    return targetChild;
  },
};
