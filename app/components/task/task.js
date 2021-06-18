
// Keep namespace clean by creating all task-related models and methods inside of container component
let taskComponent = 
{
    
    // store array of tasks loaded into memory during a session.
    taskArray : [], 

    // task object factory to create complex task object using simple task json schema
    faskFactory : function (simpleTaskJson)
    {
        
    }



} 

// sample array of tasks to emulate data
let taskList = 
[
    {
		"status": "True",
		"description": "non, vestibulum nec, euismod in, dolor. Fusce feugiat. Lorem ipsum",
		"userId": 1
	},
	{
		"status": "False",
		"description": "et pede. Nunc sed orci lobortis augue scelerisque mollis. Phasellus",
		"userId": 2
	},
	{
		"status": "True",
		"description": "arcu. Vestibulum ante ipsum primis in faucibus orci luctus et",
		"userId": 3
	},
	{
		"status": "True",
		"description": "sit amet, risus. Donec nibh enim, gravida sit amet, dapibus",
		"userId": 4
	},
	{
		"status": "True",
		"description": "Nullam feugiat placerat velit. Quisque varius. Nam porttitor scelerisque neque.",
		"userId": 5
	},
	{
		"status": "True",
		"description": "montes, nascetur ridiculus mus. Proin vel arcu eu odio tristique",
		"userId": 6
	},
	{
		"status": "False",
		"description": "lorem. Donec elementum, lorem ut aliquam iaculis, lacus pede sagittis",
		"userId": 7
	},
	
]

