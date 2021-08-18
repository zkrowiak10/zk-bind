import {
  BoundElement,
  proxyObservable,
  utils,
  zk,
  ParseDOMforObservables,
} from "./zk";
import type { SubModel } from "./zk";

export class ObservableObject {
  receivers: BoundElement[] = [];
  transmitters: BoundElement[] = [];
  forEachComponents: BoundElement[] = [];
  subscribers: BoundElement[] = [];
  parent?: ObservableObject;
  dataObject: any;
  dataObjectProxy: proxyObservable;
  $model: any;
  $parentModel?: any;
  handler = {
    get: (target: any, property: keyof typeof target, receiver: any) => {
      if (typeof target[property] == "function") {
        if (target instanceof Date) {
          // @ts-ignore
          return target[property].bind(target);
        }
      }

      // for certain operations, it is necessary to verify that the target object is the same spot in memory as
      // some other reference to it.
      if (property == "_targetObject") {
        return target;
      }
      if (property == "_observableObject") {
        return this;
      }
      if (property == "$parentModel") {
        return this.$parentModel;
      }
      if (property == "$model") {
        return this.$model;
      }

      return target[property];
    },
    set: (target: { [x: string]: any }, property: string, value: any) => {
      if (Array.isArray(target)) {
        this.updateArrayOnSet(target, property, value);
        return true;
      }

      if (property == "$model") {
        this[property] = value;
      }
      target[property] = value;
      this.updateOnStateChangeByOref(target, property);

      return true;
    },

    deleteProperty: (target: { [x: string]: any }, property: any) => {
      if (Array.isArray(target)) {
        this.updateArrayOnDelete(target, property);
        return true;
      }
      delete target[property];
      return true;
    },
  };

  constructor(obj: any, parent?: ObservableObject) {
    this.dataObject = obj;
    this.parent = parent;
    this.dataObjectProxy = utils.deepProxy(this.dataObject, this.handler);
  }

  getProxy(): proxyObservable {
    return this.dataObjectProxy;
  }

  // Function to update all elements on state change by oref
  // Function receives the object which contains the updated property, and the property key
  updateOnStateChangeByOref(
    oRefParent: any,
    property: string | number | symbol
  ) {
    for (let element of this.receivers) {
      if (
        element.target._targetObject === oRefParent &&
        property == element.property
      ) {
        element.update();
      }
    }
  }

  // Parse property path of binding and return object at that location
  returnTargetProperty(pathToObject: string, getParent = false) {
    let targetChild = this.dataObjectProxy;
    let splitPath = pathToObject.split(".");
    if (splitPath[0] == "root") {
      targetChild = zk.root_model;
    }
    if (splitPath[0] == "$parentModel") {
      targetChild = this.$parentModel;
      let i = 1;
      while (splitPath[i] == "$parentModel") {
        targetChild = targetChild.$parentModel;
      }
    }
    for (let i = 1; i < splitPath.length; i++) {
      if (getParent && i == splitPath.length - 1) {
        return targetChild;
      }
      targetChild = targetChild[splitPath[i]];
      if (typeof targetChild === "undefined") {
        throw new Error(pathToObject + " is an invalid property path");
      }
    }
    return targetChild;
  }

  // take a bound 'transmitter' element and add an event lister to update model object and transmit to receivers
  initializeTransmitter(boundElement: BoundElement, bindMode: string) {
    // A transmitter should always be an input element in HTML. Currently, the supported elemetns
    // Are text, date, datetime, checked
    let target = boundElement.target;
    let property = boundElement.property;
    let updateValue = target[property];

    if (!(boundElement instanceof BoundElement)) {
      throw new Error("Invalid argument to initialize transmitter");
    }
    if (bindMode == "radio") {
      let options = boundElement.DOMelement.querySelectorAll("input");
      for (let option of options) {
        if (option.value == updateValue) {
          option.checked = true;
        }
        option.addEventListener("input", function () {
          if (option.checked) {
            target[property] = option.value;
          }
        });
      }
      return;
    }
    if (!(boundElement.DOMelement instanceof HTMLInputElement)) {
      throw new Error(
        `Invalid html element binding: "${bindMode}" must be bound to an input element`
      );
    }

    if (boundElement.DOMelement.type == "date") {
      if (updateValue) {
        updateValue = new Date(updateValue);
        try {
          updateValue = updateValue.toISOString().split("T")[0];
        } catch (err) {
          console.error(
            "error converting date object",
            updateValue,
            err.message
          );
        }
      }
    }

    if (bindMode == "datetime-local") {
      updateValue = new Date(updateValue);
      updateValue = updateValue._targetObject.toISOString();
    }

    boundElement.DOMelement.value = updateValue || "";

    boundElement.DOMelement.addEventListener("input", () => {
      if (boundElement.DOMelement instanceof HTMLInputElement) {
        let nodeValue: string | boolean | Date = boundElement.DOMelement.value;
        if (bindMode == "date") {
          nodeValue = new Date(nodeValue);
          return;
        }
        if (boundElement.DOMelement.type == "checkbox") {
          nodeValue = boundElement.DOMelement.checked;
        }
        target[property] = nodeValue || "";
      }
    });
  }

  // A 'for' binder repeats the syntax in the children elements for each item in the defined iterable
  // This function must be able to control the items in the list (push/pop) and change their value if the
  // model data changes.
  initializeForeach(boundElement: BoundElement): void {
    // parse syntax, note that 'objectPath' refers to the foreach syntax of the for element
    // which follows foreach syntax (item of list)
    let tempList = boundElement.objectPath.split("of");
    let iteratorKey = tempList[0].trim();
    let iterableObjectPath = tempList[1].trim();
    let iterable = this.returnTargetProperty(iterableObjectPath);
    if (boundElement.DOMelement.children.length > 1) {
      console.error(
        `For element must have only one child at`,
        boundElement.DOMelement
      );
      return;
    }
    let templateNode = boundElement.DOMelement.removeChild(
      boundElement.DOMelement.children[0]
    );

    if (!(templateNode instanceof HTMLElement)) {
      throw new Error("Template node must be instance of HTMLElement");
    }
    // The current bound element is the 'for' parent element containing the iterated objects
    // this element needs to store all of its children, the html template for creating a new child,
    // and the iteratore key (eg 'item')
    boundElement.objectPath = iterableObjectPath;

    let oRefPath = utils.prepareObjectPath(boundElement.objectPath);
    boundElement.target = iterable;
    boundElement.observableChildren = [];
    boundElement.templateNode = templateNode;
    boundElement.iteratorKey = iteratorKey;

    // The application should enforce that the boundElement only has one root (the iterator template)
    // Then, it should clone that item and append it iterable.length - 1 times
    // The parent object (curent boundElement) needs to be added to the bound elements array
    // problem noted: when the ObservableObject instantiates, it copies the object parameter, meaning that scoped sub models
    // Do not reflect changes to the object model they are descendent from
    let index = 0;
    if (!Array.isArray(iterable)) {
      throw new Error(
        `'For' element much bind to an iterable at ${boundElement.DOMelement}`
      );
    }
    for (let item of iterable) {
      // Create clone of template node for each bound element
      let clone = templateNode.cloneNode(true);
      boundElement.DOMelement.appendChild(clone);

      // a 'for' element creates its own autonomous model scope with the 'item' being a new observable object inserted into
      // a sub model
      let subModel: any = {};
      let newObj = new ObservableObject(item, this);

      subModel[iteratorKey] = newObj.dataObjectProxy;
      subModel.$parentModel = this.$model;
      newObj.$model = subModel;

      if (!(clone instanceof HTMLElement)) {
        throw new Error(
          `'for' binding template node must be an instance of HTMLElement at ${clone}`
        );
      }

      ParseDOMforObservables(subModel, clone);

      var subModelContext: SubModel = {
        subModel: subModel,
        node: clone,
      };

      boundElement.observableChildren.push(subModelContext);

      // replace array item with its observable version
      iterable[index++] = newObj.dataObjectProxy;
    }

    this.forEachComponents.push(boundElement);
  }
  updateArrayOnSet(
    targetArr: any[],
    targetProperty: string | number,
    value: any
  ) {
    // locate appropriate array of bound elements in forEachComponents (this should be a 'for' element)
    // targetArr is an array part of the obj argument to observable object, this function is called when updating
    // its Proxy object.
    var boundElement: BoundElement;

    // Find the correct BoundElement in the list of 'forEachComponents',
    // which represent all arrays inside of the ObservableObject
    // that have been bound to a for binding in the DOM.
    for (let item of this.forEachComponents) {
      if (item.target._targetObject == targetArr) {
        boundElement = item;
        break;
      }
    }
    if (targetProperty == "length") {
      targetArr[targetProperty] = value;
      if (boundElement) {
        boundElement.observableChildren.length = value;
        while (boundElement.DOMelement.children.length > value) {
          boundElement.DOMelement.lastChild.remove();
        }
      }
      return;
    }
    if (typeof targetProperty == "string") {
      targetProperty = Number.parseInt(targetProperty);
    }

    // Presence of boundElement means that this array is bound to a DOM element
    if (boundElement) {
      let insertNode: Node;

      // construct new child node
      insertNode = boundElement.templateNode.cloneNode(true);

      if (!(insertNode instanceof HTMLElement)) {
        throw new Error(`Template node is not of type HTMLElement`);
      }
      let subModel: any = {};
      // If value being set is not an observable object
      if (!value._observableObject) {
        // creat subModel for child node observable scope and add the observable to the array

        value = new ObservableObject(value).dataObjectProxy;

        subModel[boundElement.iteratorKey] = value;
        value._observableObject.$model = subModel;
        subModel.$parentModel = this.$model;
        // Create submodel context that stores node-element pairing
        let subModelContext = {
          subModel: subModel,
          node: insertNode,
        };

        boundElement.observableChildren[targetProperty] = subModelContext;
        ParseDOMforObservables(subModel, insertNode);
      }

      // this makes assumption that if it is NOT an observable object, it is an existing item in the array.
      else {
        // Locate the observable child of the bound 'for' element where
        // the observable object at observableChild.subModel[iteratorKey]
        // equals the value parameter of this function
        // Reminder: 'iteratorKey' is whatever the DOM element declares a <item> in the foreach bind
        let iteratorKey = boundElement.iteratorKey;

        let observableChild = boundElement.observableChildren.find((item) => {
          return item.subModel[iteratorKey] == value;
        });
        // if the inserted object is an observable, but is not currently in the bound array
        if (!observableChild) {
          subModel[boundElement.iteratorKey] = value;
          value._observableObject.$model = subModel;
          subModel.$parentModel = this.$model;
          // Create submodel context that stores node-element pairing
          let subModelContext = {
            subModel: subModel,
            node: insertNode,
          };

          boundElement.observableChildren[targetProperty] = subModelContext;
          ParseDOMforObservables(subModel, insertNode);
        } else {
          boundElement.observableChildren[targetProperty] = observableChild;
          // Reminder: 'observableChild' refers to a subModelContext containing a submodel and a html node

          ParseDOMforObservables(observableChild.subModel, insertNode);
        }
      }
      // Insert node in appropriate index position
      // Get current node at that position
      let currentIndex = boundElement.DOMelement.children[targetProperty];
      if (Number(targetProperty) == boundElement.DOMelement.children.length) {
        boundElement.DOMelement.appendChild(insertNode);
      } else {
        boundElement.DOMelement.replaceChild(insertNode, currentIndex);
      }
    }

    // push the object to the the data object proxy array
    targetArr[targetProperty] = value;
  }
  updateArrayOnDelete(
    targetArr: { [x: string]: any },
    targetProperty: string | number
  ) {
    let boundElement: BoundElement;

    if (typeof targetProperty == "string") {
      if (Number.parseInt(targetProperty) == NaN) {
        throw new Error("Array index must be an integer value");
      }
    }

    for (let item of this.forEachComponents) {
      if (item.target._targetObject == targetArr) {
        boundElement = item;
        break;
      }
    }
    if (typeof targetProperty == "string") {
      targetProperty = Number.parseInt(targetProperty);
    }

    // Presence of boundElement means that this array is bound to a DOM element
    if (boundElement) {
      // find the node in the for element to delete and delete it from DOM
      let currentIndex = boundElement.DOMelement.children[targetProperty];
      boundElement.DOMelement.removeChild(currentIndex);

      // remove element from observable children to maintain parity between that list and the targetArr
      delete boundElement.observableChildren[targetProperty];
    }

    // Finally, delete element in targetArr
    delete targetArr[targetProperty];
  }
  // function to register an element, perform any intialization,a nd add to appropriate array
  registerElement(bindMode: string, boundElement: BoundElement) {
    let objectPath: string;
    var callBackPath: string;
    var attr: string;
    var binding: string;
    var targetPath: string;
    switch (bindMode) {
      case "text":
      case "checked":
      case "radio":
      case "date":
        this.transmitters.push(boundElement);
        let oRefPath = utils.prepareObjectPath(boundElement.objectPath);
        boundElement.target = utils.returnTargetProperty(
          this.dataObjectProxy,
          oRefPath,
          true
        );
        var splitPath = boundElement.objectPath.split(".");
        boundElement.property = splitPath[splitPath.length - 1];
        this.initializeTransmitter(boundElement, bindMode);
        break;

      case "format":
        // format binds have syntax "format: objectPath|callbackFunction"
        [objectPath, callBackPath] = boundElement.objectPath.split("|");
        try {
          boundElement.updateCallback = utils.returnTargetProperty(
            this.dataObjectProxy,
            callBackPath
          );
        } catch (err) {
          console.error(err.message);
        }
        boundElement.objectPath = objectPath;
      case "value":
        targetPath = utils.prepareObjectPath(boundElement.objectPath);
        boundElement.target = utils.returnTargetProperty(
          this.dataObjectProxy,
          targetPath,
          true
        );
        splitPath = boundElement.objectPath.split(".");
        boundElement.property = splitPath[splitPath.length - 1];
        this.receivers.push(boundElement);
        boundElement.update();
        break;

      case "attr":
        // attr bindings follow syntax "attr: targetAttr|binding"
        [attr, binding, callBackPath] = boundElement.objectPath.split("|");
        if (callBackPath) {
          try {
            boundElement.updateCallback = utils.returnTargetProperty(
              this.dataObjectProxy,
              callBackPath
            );
          } catch (err) {
            console.error(err.message);
          }
        }

        boundElement.objectPath = binding;
        splitPath = boundElement.objectPath.split(".");
        boundElement.property = splitPath[splitPath.length - 1];
        targetPath = utils.prepareObjectPath(boundElement.objectPath);
        boundElement.target = utils.returnTargetProperty(
          this.dataObjectProxy,
          targetPath,
          true
        );
        splitPath = boundElement.objectPath.split(".");
        this.receivers.push(boundElement);
        boundElement.attr = attr;
        boundElement.update();
        break;
      case "for":
        this.initializeForeach(boundElement);
        break;
      case "hidden":
        targetPath = utils.prepareObjectPath(boundElement.objectPath);
        boundElement.target = utils.returnTargetProperty(
          this.dataObjectProxy,
          targetPath,
          true
        );
        splitPath = boundElement.objectPath.split(".");
        boundElement.property = splitPath[splitPath.length - 1];
        this.receivers.push(boundElement);
        boundElement.update = function () {
          boundElement.DOMelement.hidden =
            boundElement.target[boundElement.property];
        };
        boundElement.update();
        break;

      case "visible":
        targetPath = utils.prepareObjectPath(boundElement.objectPath);
        boundElement.target = utils.returnTargetProperty(
          this.dataObjectProxy,
          targetPath,
          true
        );
        splitPath = boundElement.objectPath.split(".");
        boundElement.property = splitPath[splitPath.length - 1];

        this.receivers.push(boundElement);
        boundElement.update = function () {
          boundElement.DOMelement.hidden =
            !boundElement.target[boundElement.property];
        };
        boundElement.update();
        break;
    }
  }
  //  subscribe(eventTypes, target, property, callback) {
  // this.eventTypes = eventTypes
  // this.target = target
  // this.property = property
  // this.callback = callback

  // if (!(target instanceof zk.ObservableObject)) {
  //     throw new Error("Invalid subscription target. Subscribe must be called on an ObservableObject")
  // }

  // if (!target._subscribers) {
  //     target._subscribers = []
  // }
  // target._subscribers.push(this)
  // this.applyCallbacks(eventType) = function() {
  //     if (!callback){return}

  //     if (eventTypes.includes(eventTypes)) {
  //         callback(eventType, target)
  //     }

  // }
}

export function makeObservable(obj: any, parent?: proxyObservable) {
  var observable = new ObservableObject(obj);
  return observable.getProxy();
}
