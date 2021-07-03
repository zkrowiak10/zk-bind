
// parent function to store entire framework as singleton
function zk() {
    
    zk_self = this
    root_model = {}

    // Function to initiate any object variables accessible to all zk objects
    // Then begin recursively parsing DOM for observable elements
    // Parameters
    // Model: an object containing observable objects 
    // Root: An html node that is the root element of all observable objects
    zk_self.initiateModel = function initiateModel(model, root) {

        self.root_model = model

        if ((!root instanceof HTMLElement)) {
            throw new Error("Invalid argument: second parameter must be an HTML element")
        }
        ParseDOMforObservables(model,root)

    }
    // Recursive function that locates and registers any html element descending from root that should be observed 
    function ParseDOMforObservables(model, root) 
    {       

        // if HTML element contains binder
        if (root.getAttribute('zk-bind')){

            // parse the bind command
            // bind syntax is '<bindMode>: <object path'
            let binder = root.getAttribute('zk-bind')
            let splitBinder = binder.split(":")

            if (splitBinder.length < 2) {throw new Error("Invalid binding at:", root)}

            // isolate bindMode string and object path (getting rid of preceding white space)
            let bindMode = splitBinder[0] 
            let objectPath = splitBinder[1].trim()

            // Current array of valid bind modes for validity checking
            validBindModes = ['text', 'value', 'for', 'on', 'date', 'checkbox', 'datetime', 'calc']


            // Verify that bind mode is valid
            if (!validBindModes.includes(bindMode)) 
            {
                throw new Error(bindMode + " is not a valid bind mode")
            } 


            // Parent object in path is expected to be an attribute of the model parameter of this function
            // Parse parent object, and add this element to the appropriate list
            let parentObject = objectPath.split('.')[0]

            // A little messy, but 'for' binders receive an argument of 'indexKey of iterable' where
            // iterable is the typical objectpaty. 
            if (bindMode === 'for') {
                parentObject = objectPath
                                .split('of')[1]
                                .trim()
                                .split('.')[0]  
            }
            // Check that bind reference exists in model
            if ((typeof model[parentObject] === undefined)) {
                throw new Error (parentObject + "Is not a registered observable")
            }
            

            // Push the element to the appropriate list 
            boundElement = new BoundElement(root, objectPath, bindMode)

            if ((bindMode == 'on')) {
                
                registerListener(boundElement, model)
                return
            }

            if (!model[parentObject]) {throw new Error("Invald object path at ", parentObject)}

            model[parentObject].registerElement(bindMode, boundElement)

            // Some binders, such as 'for' binders, create a separate tree model for all of their children
            // This array contains a list of all 'uprooting' binders
            let uprootingBinders = ['for']

            // This root becomes a new tree, so now further exploration of this branch can happen to avoid duplicate bindings
            if (uprootingBinders.includes(bindMode)) {
                
                return
            }


            }

        children = root.children
        
        // iterate through children 
        walkIterator:
        for (child of children) {

            // Recursively parse all children of current root element
            ParseDOMforObservables(model, child) 
   
        }
    }

    // instantiates a bound element storing the DOM element and the object path to which it is linked
    function BoundElement(DOMelement, objectPath, bindMode) {
        this.DOMelement = DOMelement
        this.objectPath = objectPath
        this.bindMode = bindMode
        this.oRef = undefined
        this.property = undefined
        this.observableChildren = undefined 

        this.update = function() {

            let value = this.oRef[this.property]

            if (value instanceof Date) {
                value = value._targetObject.toISOString()
                // TODO add configuration callbacks for date string formatting
            }

            this.DOMelement.innerText = value
                
            
        }
    }

    // takes a standard JSON object as a parameter, instantiate an observable object
    zk_self.ObservableObject = function ObservableObject(obj, parent) {
        
        let self = this;

        self.parent = parent

        

        // Create empty array for both text and value elements as well as components
        let receivers = []
        let transmitters = []
        let forEachComponents = []
        let subscribers = []
        
        
        let handler = {
            get: function(target, property,receiver) {
                
                if (typeof target[property] == "function") {
                    
                    if (target instanceof Date) {
                        return target[property].bind(target)
                    }

                }   
                        
                // for certain operations, it is necessary to verify that the target object is the same spot in memory as 
                // some other reference to it.
                if (property == "_targetObject") {return target}
                return target[property]
            }, 
            set: function(target, property, value) {
                
                // console.log('setting', target, "prop ", property, "to: ", value)

                if (Array.isArray(target)) {
                    updateArrayOnSet(target, property, value)
                    // console.log("setting", property, "to ", value)
                    return true
                }
                
                target[property] = value
                updateOnStateChangeByOref(target, property, value)

                
                return true
            },

            deleteProperty(target, property){
                if (Array.isArray(target)) {
                    updateArrayOnDelete(target, property)
                    // console.log('deleting', property, "from", target)
                    return true
                }
                delete target[prop]
                return true
            }
            
        
        }

        let dataObject = obj

        let dataObjectProxy = utils.deepProxy(dataObject, handler)
        // All properties of the input object should be exposed as if they were native properties of the observable object
        for (let property in dataObjectProxy) {

 
            Object.defineProperty(self, property, {
                get(){return dataObjectProxy[property]},
                set(value) {
                    dataObjectProxy[property] = value
                    return true
                }

        
            })
            
            
        }


        // Function to update all elements on state change by oref
        // Function receives the object which contains the updated property, and the property key
        function updateOnStateChangeByOref(oRefParent, property, value) {
            for (let element of receivers) {
                if ((element.oRef._targetObject === oRefParent) && (property == element.property) ){
                    element.update()
                }
            }
            for (let subscriber of subscribers) {
                if ((subscriber.target._targetObject === oRefParent) && (property == subscriber.property) ){
                    subscriber.applyCallbacks()
                }
            }
        }
 
        
        // Parse property path of binding and return object at that location
        function returnTargetProperty(pathToObject, getParent = false) {
            let targetChild = dataObjectProxy
            let splitPath = pathToObject.split('.')
            if (splitPath[0]=="root")  {targetChild= self.root_model }
            for (let i = 1; i < splitPath.length; i++) {
                if  (getParent && (i == (splitPath.length - 1))) {return targetChild}
                targetChild = targetChild[splitPath[i]]
                if (typeof targetChild === "undefined") {
                    throw new Error(pathToObject + " is an invalid property path")
                }
                
            
            

            }
            return targetChild
        }


        // take a bound 'transmitter' element and add an event lister to update model object and transmit to receivers
        function initializeTransmitter(boundElement, bindMode) {

                // A transmitter should always be an input element in HTML. Currently, the supported elemetns
                // Are text, date, datetime, checked
                if(!(boundElement instanceof BoundElement)) {throw new Error('Invalid argument to initialize transmitter')}

                let oRef = boundElement.oRef
                let property = boundElement.property
                let updateValue = oRef[property]

                if (bindMode == "date") {
                    if (updateValue instanceof Date) {
                        updateValue = updateValue._targetObject.toISOString().split('T')[0]
                        
                    }
                    else {throw new Error("Invalid value for 'Date' binding: ", updateValue)}
                }
                if (bindMode == "datetime-local")  {
                    if (updatValue instanceof Date) {
                        updateValue = updateValue._targetObject.toISOString()
                    }
                    else {throw new Error("Invalid value for 'Date' binding: ", updateValue)}
                }
                boundElement.DOMelement.value = updateValue
             
                
                boundElement.DOMelement.addEventListener("input", (KeyboardEvent) => {
                    
                    
                    let nodeValue = boundElement.DOMelement.value
                    if (bindMode == "date") {
                        oRef[property] = new Proxy(new Date(nodeValue), handler)
                        return
                    }
                    oRef[property] = nodeValue
            })
        }

        



        // A 'for' binder repeats the syntax in the children elements for each item in the defined iterable
        // This function must be able to control the items in the list (push/pop) and change their value if the
        // model data changes.
        function initializeForeach(boundElement) {

            // parse syntax, note that 'objectPath' refers to the foreach syntax of the for element
            // which follows foreach syntax (item of list)
            
            tempList  = boundElement.objectPath.split('of')
            let iteratorKey = tempList[0].trim()
            let iterableObjectPath = tempList[1].trim()
            let iterable = returnTargetProperty(iterableObjectPath)
            let oldChild = boundElement.DOMelement.removeChild(boundElement.DOMelement.children[0])
            // The current bound element is the 'for' parent element containing the iterated objects
            // this element needs to store all of its children, the html template for creating a new child, 
            // and the iteratore key (eg 'item')
            boundElement.objectPath = iterableObjectPath

            oRefPath = utils.prepareObjectPath(boundElement.objectPath)
            boundElement.oRef = utils.returnTargetProperty(dataObject, oRefPath)
            boundElement.observableChildren = []
            boundElement.templateNode = oldChild
            boundElement.iteratorKey = iteratorKey

            
            // The application should enforce that the boundElement only has one root (the iterator template)
            // Then, it should clone that item and append it iterable.length - 1 times 
            // The parent object (curent boundElement) needs to be added to the bound elements array
            // problem noted: when the ObservableObject instantiates, it copies the object parameter, meaning that scoped sub models
            // Do not reflect changes to the object model they are descendent from
            let index = 0;
            for (let item of iterable) {
                
                // Create clone of template node for each bound element
                let clone = oldChild.cloneNode(true)
                boundElement.DOMelement.appendChild(clone)

                // a 'for' element creates its own autonomous model scope with the 'item' being a new observable object inserted into
                // a sub model
                let subModel = {}
                let newObj = new ObservableObject(item,self)
                
                
                subModel[iteratorKey] = newObj


                ParseDOMforObservables(subModel, clone)

                
                subModelContext = {
                    "subModel": subModel,
                    "node" : clone

                }
                boundElement.observableChildren.push(subModelContext)

                // replace array item with its observable version
                iterable[index++] = newObj
            }
            
            forEachComponents.push(boundElement)
        }

        function updateArrayOnDelete(targetArr, targetProperty) {
            let boundElement;

            if (Number.parseInt(targetProperty) == NaN) {throw new Error("Array index must be an integer value")}
            
            for (let item of forEachComponents) {
                if (returnTargetProperty(item.objectPath)._targetObject == targetArr){
                    boundElement = item
                    break
                }
            }
            if(boundElement) {

                // find the node in the for element to delete and delete it from DOM
                let currentIndex = boundElement.DOMelement.children[targetProperty]
                boundElement.DOMelement.removeChild(currentIndex)

                // remove element from observable children to maintain parity between that list and the targetArr
                delete boundElement.observableChildren[targetProperty]
            }
            

            // Finally, delete element in targetArr
            delete targetArr[targetProperty]
            
            
        }
        // this method is called by the handler 'set' function so that the DOM mirrors the array on state change
        function updateArrayOnSet(targetArr, targetProperty, value) {
            
            // locate appropriate array of bound elements in forEachComponents (this should be a 'for' element)
            // targetArr is an array part of the obj argument to observable object, this function is called when updating 
            // its Proxy object.
            let boundElement;

            
            
            for (let item of forEachComponents) {
                if (returnTargetProperty(item.objectPath)._targetObject == targetArr){
                    boundElement = item
                    break
                }
            }
            if ((targetProperty == "length")) {
                targetArr[targetProperty] = value
                if (boundElement) {
                    boundElement.observableChildren.length = value
                }
                return
                
            }
           // no action if there are no elements in model observing
            if (boundElement) {
                let insertNode 
                // If value being set is not an observable object
                if (!(value instanceof ObservableObject)) {
                     // construct new child node
                     insertNode = boundElement.templateNode.cloneNode(true)

                    

                    // creat subModel for child node observable scope and add the observable to the array
                    let subModel = {}
                    value = new ObservableObject(value)
                    value.parent = self
                    subModel[boundElement.iteratorKey] = value

                    // Create submodel context that stores node-element pairing
                    subModelContext = {
                        "subModel": subModel,
                        "node" : insertNode
                    }

                    boundElement.observableChildren[targetProperty] = subModelContext
                    ParseDOMforObservables(subModel, insertNode)
                }
                
                else {
                    // Locate the observable child of the bound 'for' element where
                    // the observable object at observableChild.subModel[iteratorKey]
                    // equals the value parameter of this function
                    // Reminder: 'iteratorKey' is whatever the DOM element declares a <item> in the foreach bind
                    let iteratorKey = boundElement.iteratorKey
                    
                    let observableChild = boundElement.observableChildren.find((item)=> {
                        return item.subModel[iteratorKey] == value
                    })

                    boundElement.observableChildren[targetProperty]  = observableChild
                    console.log(`setting ${targetProperty} to`, observableChild)
                    // Reminder: 'observableChild' refers to a subModelContext containing a submodel and a html node
                    insertNode = observableChild.node

                }
                // Insert node in appropriate index position
                // Get current node at that position
                
                let currentIndex = boundElement.DOMelement.children[targetProperty]
                if (targetProperty == boundElement.DOMelement.length) {
                    boundElement.appendChild(currentIndex)
                }
                else {
                    boundElement.DOMelement.insertBefore(insertNode,currentIndex)
                }
                
               
            }
            
            // push the object to the the data object proxy array
            targetArr[targetProperty] = value



        }

        this.popFromForEach = function(arrayPath, index)  {
                    // locate appropriate bound element in forEachComponents
                    let component = forEachComponents.find(item => {return item.objectPath === arrayPath})
                    if (!component) {throw new Error('The specified array does not exist')}
                    let temp = component.observableChildren[index]
                    if (!temp) {throw new Error('The specified index does not exist in the array')}
                    component.observableChildren.splice(index,1)
                    temp[component.iteratorKey].deleteAllReferences(null,true)

                    let dataArray = returnTargetProperty(arrayPath)
                    dataArray.splice(index,1)

        }



        // function to register an element, perform any intialization,a nd add to appropriate array
        this.registerElement = function (bindMode, boundElement) {

            switch (bindMode) {
                case "text" :
                case "date" :
                case "checked":
                case "datetime":
                    transmitters.push(boundElement);
                    oRefPath = utils.prepareObjectPath(boundElement.objectPath)
                    boundElement.oRef = utils.returnTargetProperty(dataObjectProxy, oRefPath, true)
                    var splitPath = boundElement.objectPath.split(".")
                    boundElement.property = splitPath[(splitPath.length-1)]
                    initializeTransmitter(boundElement, bindMode);
                    break
                case "value": 
                    
                    transmitters.push(boundElement);
                    oRefPath = utils.prepareObjectPath(boundElement.objectPath)
                    boundElement.oRef = utils.returnTargetProperty(dataObjectProxy, oRefPath, true)
                    splitPath = boundElement.objectPath.split(".")
                    boundElement.property = splitPath[(splitPath.length-1)]
                    receivers.push(boundElement);
                    boundElement.update()
                    break
                case "for":
                    initializeForeach(boundElement);
                    break
            }
        }
    }
    zk_self.subscribe = function(eventTypes, target, property, callback) {
        this.eventTypes = eventTypes
        this.target = target
        this.property = property
        this.callback = callback

        if (!(target instanceof zk_self.ObservableObject)) {
            throw new Error("Invalid subscription target. Subscribe must be called on an ObservableObject")
        }

        subscribers.push(this)
        this.applyCallbacks(eventType) = function() {

            if (eventTypes.includes(eventTypes)) {
                callback(eventType, target)
            }
                
        }

    }

    // 'on' binds have an object path of <event>|<callback>
    function registerListener(boundElement, model) {
        // Locate split end parentheses off
        let eventType, methodSignature
        [eventType, methodSignature] = boundElement.objectPath.split('|')
        let methodName = methodSignature.split('(')[0]
        let parameters = methodSignature.split('(')[1].split(')')[0]
        let argArray = []
        for (key of parameters.split(',')){
            argArray.push(model[key])
        }
        
        let callback = utils.returnTargetProperty(model,methodName)
        boundElement.DOMelement.addEventListener(eventType, function(){callback.apply(null,argArray)})
    }

    let utils = {
        deepClone : function deepClone(object) {
            let newObject = {}
            if (typeof object != "object") {
                return object}
            for (property in object) {
                if (Array.isArray(property)) {
                    let newArray = []
                    for (item of array) {
                        cloneItem = deepClone(item)
                        newArray.push(cloneItem)
                    }
                }
                newObject[property] = deepClone(object[property])
            }
            return newObject

        },
        deepProxy:  function deepProxy(object, handler) {
            if (typeof object == "function") {return new Proxy(object, handler)}
            for (let item in object) {
                
                if (Array.isArray(object[item])) {
                    

                    for (let i = 0; i < object[item].length; i++) {
                        object[item][i] = deepProxy(object[item][i], handler)
                    }
                    object[item] = new Proxy(object[item], handler)
                    continue
                }

                if (typeof object[item] == "object"){
                    object[item] = deepProxy(object[item], handler)
                }
            }
            if (typeof object == "object") {
                return new Proxy(object, handler)

            }
            return object
        },
        // method to remove first and last object for oRef attribut
        prepareObjectPath: function (objectPath) {
            let objArray = objectPath.split(".")
            let property = objArray[(objArray.length-1)]
            objArray = objArray.splice(1)
            objArray = objArray.join(".")
            return objArray

        },
        // generalizing the method to access object property using string path such as "person.task.dueDate"
        returnTargetProperty: function returnTargetProperty(dataObjectProxy, pathToObject, getParent) {
            let targetChild = dataObjectProxy
            let splitPath = pathToObject.split('.')
            if (splitPath[0]=="root")  {
                targetChild= self.root_model
                splitPath.splice(0,1)
             }
            for (let i = 0; i < splitPath.length; i++) {
                if  (getParent && (i == (splitPath.length - 1))) {return targetChild}
                targetChild = targetChild[splitPath[i]]
                if (!targetChild) {
                    throw new Error(pathToObject + " is an invalid property path")
                }
            
            

            }
            return targetChild
        },
        
        
    }
}
zk = new zk()



