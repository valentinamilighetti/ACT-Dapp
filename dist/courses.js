async function displayCourses() {

  const courseCounter = await ACTContract.methods.courseCounter().call();
  const courseList = document.getElementById("courseList");
  courseList.innerHTML = "";

  if (!accountAddr) {
        //TODO
        return;
    }else document.getElementById("createCourseButton").style.display = "block";

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
          <p>Hai già acquistato tutti i Corsi disponibili!</p>
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
          <span class="card-description">Descrizione: ${course.description}</span><br>
          <span class="card-description">Promotore: ${course.promoter}</span>
        </div>
        <div class="card-body">
          <div class="card-detail">
            <i class="fas fa-coins"></i>
            <span>${course.requiredTokens} ACT richiesti</span>
          </div>
          <button class="card-button" onclick="buyCourse(${courseId})">
            <i class="fas fa-shopping-cart"></i> Acquista Corso
          </button>
        </div>
      `;

      courseList.appendChild(card);
    });
  } else {
    courseList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-wallet"></i>
        <p>${accountAddr ? 'Nessun corso disponibile' : 'Connetti il wallet per visualizzare i corsi'}</p>
      </div>
    `;
  }
}

async function buyCourse(courseId) {
    try {
        const course = await ACTContract.methods.courses(courseId).call();
        const balance = await ACTContract.methods.balanceOf(accountAddr).call();

        if (balance < course.requiredTokens) {
            alert("Non hai abbastanza ACT");
            return;
        }

        if (course.courseOwner.toLowerCase() === accountAddr.toLowerCase()) {
            alert("Non puoi acquistare un corso che hai creato tu.");
            return;
        }

        await ACTContract.methods.buyCourse(courseId).send({
            from: accountAddr
        });

        alert(`Hai acquistato il corso ${course.name}!`);
        displayCourses(); 
        updateDashboard();

    } catch (err) {
        alert("Errore durante l'acquisto: " + err.message);
    }
}

async function createCourse(){
    // Create modal container
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
        <div class="modal-header">
            <h3><i class="fas fa-graduation-cap"></i> Nuovo Corso</h3>
            <button class="close-modal">&times;</button>
        </div>
        <div class="modal-body">
            <form id="courseForm" class="modal-form">
            <div class="form-group">
                <label for="courseName"><i class="fas fa-tag"></i> Nome Corso</label>
                <input type="text" id="courseName" required>
            </div>
            
            <div class="form-group">
                <label for="courseDescription"><i class="fas fa-align-left"></i> Descrizione (Opzionale)</label>
                <textarea id="courseDescription" rows="3" placeholder="Descrizione del corso..."></textarea>
            </div>

            <div class="form-group">
                <label for="coursePromoter"><i class="fas fa-align-left"></i> Promotore </label>
                <input type="text" id="coursePromoter" required>
            </div>
            
            <div class="form-group">
                <label for="courseTokens"><i class="fas fa-coins"></i> Token Richiesti</label>
                <input type="number" id="courseTokens" min="1" required>
            </div>
            
            <div class="form-actions">
                <button type="button" class="cancel-button">Annulla</button>
                <button type="submit" class="submit-button">
                <i class="fas fa-plus-circle"></i> Crea Corso
                </button>
            </div>
            </form>
        </div>
        </div>
    `;

    // Add to DOM
    document.body.appendChild(modal);
    
    // Close modal handlers
    modal.querySelector('.close-modal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    modal.querySelector('.cancel-button').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Form submission
    modal.querySelector('#courseForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('courseName').value;
        const description = document.getElementById('courseDescription').value;
        const promoter = document.getElementById('coursePromoter').value;
        const requiredTokens = parseInt(document.getElementById('courseTokens').value);
        
        try {
        // Show loading state
        const submitBtn = modal.querySelector('.submit-button');
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creazione...';
        submitBtn.disabled = true;
        
        // Call contract method
        await ACTContract.methods.createCourse(
            name,
            description || '', 
            promoter,
            requiredTokens
        ).send({ from: accountAddr });
        
        // Close modal and refresh course list
        document.body.removeChild(modal);
        displayCourses();
        
        // Show success message
        showToast('Corso creato con successo!', 'success');
        } catch (error) {
            console.error('Error creating course:', error);
            showToast(`Errore: ${error.message}`, 'error');
            submitBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Crea corso';
            submitBtn.disabled = false;
        }
    });
    }

    // Helper function to show toast messages
    function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
        document.body.removeChild(toast);
        }, 300);
    }, 5000);
}