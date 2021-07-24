let person = {
    name : "harry",
    lastName: "banana",
    listItems: [
        {prop: "1", prop2: "eric", prop3: "three"},
        {prop: "2", prop2: "eric", prop3: "three"},
        {prop: "3", prop2: "eric", prop3: "three"},
        {prop: "4", prop2: "eric", prop3: "three"},
        {prop: "5", prop2: "eric", prop3: "three"},
      
    ],
    
}


function model() {
    this.person = new zk.ObservableObject(person)

    let employee = {
        hairdo: "orange",
        manager: {
            report : {
                firstName: "johnathan"
            },
            
        },
        testF: function () {console.log("testfworked")}
    }
    this.employee = new zk.ObservableObject(employee)

    this.addTaskFormValue = new zk.ObservableObject({prop: 'prop', prop2: "prop2", prop3: "three"})

    this.saveTask = function() {
        // this.person.pushToForeach('person.listItems',this.addTaskFormValue.getdataObjectProxy())
        this.person.listItems.push(this.addTaskFormValue.getdataObjectProxy())
    }
    this.removeItem = function(item) {
        let index = person.listItems.indexOf(item)
        person.listItems.splice(index, 1)
    }
    this.param = "foo"
    this.jam = "bar"

    this.testFunction = function (x, y) {
        console.log(x, y)
    }
}

mainModel = new model()
zk.initiateModel(mainModel, document.children[0])
