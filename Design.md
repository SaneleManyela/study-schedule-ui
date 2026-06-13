The theme of the page should be uniform throughout the application.

The entry point of the application should be this UI:

[text](ATTRIBUTIONS.md)

How it should work: the login access to the main application is locked behind a strict, backend-verified multi-factor authentication process. To log in, I, as an administrator, must pass both a password check and a temporary 6-digit email PIN; both steps are handled entirely on secure servers, meaning sensitive credentials are never exposed to browser traffic, and the PIN is instantly destroyed upon use, so it can never be reused or intercepted.

Once logged in, a user should see a dashboard:

![alt text](60c3faf8-0355-4c30-9089-101e9d49d428.webp)

In the image we can leave the Course category, the certifications card, the notifications option should be there.

The sidebar should lead to each of the following tabs:

- Course overview
- Study Calendar
- Study Plan
- Library

The Course Ovierview Page
 - Is a Material UI table with columns: Course; Status;  Actions. In the actions there must be icon [enroll]
 - 1.5 spacing above There must be add; update; delete buttons.
 - Below the table for viewing all courses, there should be a table where all done courses are moved. The table structure and columns should be the same as above.

The Study Calendar Page
![alt text](image.png)

The Study Plan Page

The page should have the following interface, and allow me to add a study plan for each course.

![alt text](image-1.png)
![alt text](image-2.png)

The page dropdown for course selection should look like this:

![alt text](image-3.png)

The rows of these tables should have action events that open an overview page for each course. In this overview page for each course, course information is showed: course name; if the course is being studied/engaged in/ still in the shelf.
Also in the overview page for each course - there should be 4x4 material ui cards showing each of the course material.

The Library page

- This page should have cards: one that leads to upload of books or course material for each course.
- Another that leads to a shelves page where all the course material is shown as selectable cards under each course.
- The selected course material should open inside a pdf viewer hosted in the application / integrated in the application.
- If the courseware comes as a URL Link, the adding interface should allow this.
- A link that comes as courseware should be open on a browser interface integrated inside the application, this should be true anywhere that the course is accessed for reading.

Needless to say, there should be functions and events saving to the firebase database. 