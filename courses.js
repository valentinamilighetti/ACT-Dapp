async function displayCourses() {

    const courseCounter = await ACTContract.methods.courseCounter().call();
    const courseList = document.getElementById("courseList");
    courseList.innerHTML = "";

    if (accountAddr) {
        document.getElementById("createCourseButton").style.display = "block";
    } 

    if (courseCounter > 0 && accountAddr) {
    const fromBlock = 0;
    const toBlock = "latest";

    const courses = await ACTContract.getPastEvents("CourseCreated", { fromBlock, toBlock });
    const accountCourses = await ACTContract.getPastEvents("courseCompleted", {
        filter: { user: accountAddr },
        fromBlock, toBlock
    });

    const redeemedIds = new Set(accountCourses.map(ev => ev.returnValues.courseId));
    const availableCourses = courses.filter(ev => !redeemedIds.has(ev.returnValues.courseId));

    const courseDetails = await Promise.all(
        availableCourses.map(ev =>
            ACTContract.methods.courses(ev.returnValues.courseId).call()
        )
    );

    if (availableCourses.length === 0) {
        courseList.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-graduation-cap"></i>
            <p>You have already purchased all available Courses!</p>
        </div>
        `;
        return;
    }

    courseDetails.forEach((course, index) => {
        const courseId = availableCourses[index].returnValues.courseId;
        const card = document.createElement("div");
        card.className = "card";
        
        card.innerHTML = `
        <div class="card-header">
            <i class="fas fa-graduation-cap card-icon"></i>
            <h3 class="card-title">${course.name}</h3>
            <span class="card-description">Description: ${course.description}</span><br>
            <span class="card-description">Promoter: ${course.promoter}</span>
        </div>
        <div class="card-body">
            <div class="card-detail">
            <i class="fas fa-coins"></i>
            <span>${course.requiredTokens} ACT required</span>
            </div>
            <button class="card-button" onclick="buyCourse(${courseId})">
            <i class="fas fa-shopping-cart"></i> Purchase course
            </button>
        </div>
        `;

        courseList.appendChild(card);
    });
    } else {
        courseList.innerHTML = `
            <div class="empty-state">
            <i class="fas fa-wallet"></i>
            <p>${accountAddr ? 'No courses available' : 'Connect wallet to view courses'}</p>
            </div>
        `;
    }
}

async function buyCourse(courseId) {
    try {
        const course = await ACTContract.methods.courses(courseId).call();
        const balance = await ACTContract.methods.balanceOf(accountAddr).call();

        if (balance < course.requiredTokens) {
            showToast("You don't have enough ACT", "warning");
            return;
        }

        if (course.courseOwner.toLowerCase() === accountAddr.toLowerCase()) {
            showToast("You cannot buy a course that you created.", "warning");
            return;
        }

        await ACTContract.methods.buyCourse(courseId).send({
            from: accountAddr
        });

        showToast(`You have purchased the course ${course.name}!`, "success");
        displayCourses(); 
        updateDashboard();

    } catch (err) {
        showToast("Error during purchase: " + err.message, "error");
    }
}

async function createCourse(){
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
        <div class="modal-header">
            <h3><i class="fas fa-graduation-cap"></i> New course</h3>
            <button class="close-modal">&times;</button>
        </div>
        <div class="modal-body">
            <form id="courseForm" class="modal-form">
            <div class="form-group">
                <label for="courseName"><i class="fas fa-tag"></i> Course name</label>
                <input type="text" id="courseName" required>
            </div>
            
            <div class="form-group">
                <label for="courseDescription"><i class="fas fa-align-left"></i> Description</label>
                <textarea id="courseDescription" rows="3"></textarea>
            </div>

            <div class="form-group">
                <label for="coursePromoter"><i class="fas fa-align-left"></i> Promoter </label>
                <input type="text" id="coursePromoter" required>
            </div>
            
            <div class="form-group">
                <label for="courseTokens"><i class="fas fa-coins"></i> Required token</label>
                <input type="number" id="courseTokens" min="1" required>
            </div>
            
            <div class="form-actions">
                <button type="button" class="cancel-button">Cancel</button>
                <button type="submit" class="submit-button">
                <i class="fas fa-plus-circle"></i> Create Course
                </button>
            </div>
            </form>
        </div>
        </div>
    `;

    document.body.appendChild(modal);
    
    modal.querySelector('.close-modal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    modal.querySelector('.cancel-button').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    modal.querySelector('#courseForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('courseName').value;
        const description = document.getElementById('courseDescription').value;
        const promoter = document.getElementById('coursePromoter').value;
        const requiredTokens = parseInt(document.getElementById('courseTokens').value);
        
        try {
            const submitBtn = modal.querySelector('.submit-button');
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
            submitBtn.disabled = true;
            
            await ACTContract.methods.createCourse(
                name,
                description || '', 
                promoter,
                requiredTokens
            ).send({ from: accountAddr });
            
            document.body.removeChild(modal);
            displayCourses();

            showToast('Course created!', 'success');
        } catch (error) {
            console.error('Error creating course:', error);
            showToast(`Errore: ${error.message}`, 'error');
            submitBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Create course';
            submitBtn.disabled = false;
        }
    });
}