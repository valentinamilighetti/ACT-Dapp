// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AgriCircularToken is ERC20, Ownable {

    // Struttura che definisce un progetto di circolarità
    struct EcologicProject {
        string name;                // Nome del progetto
        string description;         // Descrizione del progetto
        string location;            // Posizione del progetto
        uint256 requiredTokens;     // Numero di token necessari per completare il progetto
        bool active;                // Stato dell'attività (attivo/riscattato o completato)
        uint256 totalContributed;   // Totale dei token già contribuiti
        address projectOwner;       // Indirizzo del creatore del progetto
    }

    // Struttura che definisce un corso sulla circolarità
    struct Course {
        string name;                // Nome del progetto
        string description;         // Descrizione del progetto
        string promoter;            // Promotore del progetto
        uint256 requiredTokens;     // Numero di token necessari per acquistare il corso
        address courseOwner;        // Indirizzo del creatore del corso
    }

    // Struttura che definisce un badge 
    struct CircularityBadge {
        string name;                // Nome del progetto
        string description;         // Descrizione del progetto
        uint256 level;              // livello di importanza 
        uint256 requiredTokens;     // Numero di token necessari per acquistare il badge
    }

    // Prezzo fisso per ogni token 
    uint256 public constant TOKEN_PRICE = 0.000125 ether;  

    // Mappature per memorizzare i dati degli utenti e delle attività
    mapping(uint256 => EcologicProject) public projects;                // Progetti disponibili
    mapping(uint256 => CircularityBadge) public badge;                  // badge disponibili
    mapping(uint256 => Course) public courses;                          // corsi disponibili
    mapping(uint256 => mapping(address => uint256)) public userContributions; // Contributi per progetto e utente
    mapping(address => mapping(uint256 => bool)) hasBadgeLevel; // Controlla che un utente abbia i badge di un certo livello 
    mapping(address => mapping(string => bool)) public hasBadge;
    mapping(address => mapping(string => bool)) public hasCourse;
    uint256 public projectCounter;    // Contatore progressivo per gli ID dei progetti
    uint256 public courseCounter;     // Contatore progressivo per gli ID dei corsi
    uint256 public badgeCounter;      // Contatore progressivo per gli ID dei badge
    uint256 public totalMintedTokens; // Numero totale di token creati

    // Eventi emessi dal contratto per tracciare le azioni principali
    event TokensMinted(address indexed recipient, uint256 amount);
    event ActivityRecorded(address indexed user, string activity, uint256 quantity);

    event ProjectCreated(uint256 projectId, string name);
    event ProjectCompensated(uint256 projectId, address indexed user, uint256 tokens);
    event ProjectCompleted(uint256 projectId, address indexed projectOwner, uint256 tokens);

    event BadgeCreated(uint256 badgeId, string name);
    event badgeRedeemed(uint256 badgeId, address indexed user);

    event CourseCreated(uint256 courseId, string name);
    event courseCompleted(uint256 courseId, address indexed projectOwner, address indexed user);

    constructor() ERC20("AgriCircularToken", "ACT") Ownable(msg.sender) {
        projectCounter = 0;
        badgeCounter = 0;
        courseCounter = 0;
        totalMintedTokens = 0;
    }

    // Permette agli utenti di acquistare token inviando ETH
    function buyTokens(uint256 tokenAmount, string memory activity, uint256 quantity) public payable {
        require(msg.value >= TOKEN_PRICE * tokenAmount, "Insufficient payment");
        _mint(msg.sender, tokenAmount);
        totalMintedTokens += tokenAmount;
        emit TokensMinted(msg.sender, tokenAmount);
        emit ActivityRecorded(msg.sender, activity, quantity);
    }

    // Funzione per creare un nuovo progetto 
    function createProject(
        string memory name,
        string memory description,
        string memory location,
        uint256 requiredTokens
    ) public {
        projectCounter++;
        projects[projectCounter] = EcologicProject(
            name,
            description,
            location,
            requiredTokens,
            true,
            0,
            msg.sender
        );
        emit ProjectCreated(projectCounter, name);
    }

    //Funzione per creare un nuovo badge
    function createBadge(
        string memory name,
        string memory description,
        uint256 level,
        uint256 requiredTokens
    ) public onlyOwner {
        badgeCounter++;
        badge[badgeCounter] = CircularityBadge(
            name,
            description,
            level,
            requiredTokens
        );
        emit BadgeCreated(badgeCounter, name);
    } 

    // Funzione per creare un nuovo corso (pubblica)
    function createCourse(
        string memory name,
        string memory description,
        string memory promoter,
        uint256 requiredTokens
    ) public {
        courseCounter++;
        courses[courseCounter] = Course(
            name,
            description,
            promoter,
            requiredTokens,
            msg.sender
        );
        emit CourseCreated(courseCounter, name);
    }

    // Permette agli utenti di contribuire a un progetto spendendo token
    function compensateProject(uint256 projectId, uint256 tokenAmount) public {
        require(projectId > 0 && projectId <= projectCounter, "Invalid project ID");
        require(projects[projectId].active, "Project not active");
        require(balanceOf(msg.sender) >= tokenAmount, "Insufficient tokens");

        EcologicProject storage project = projects[projectId];
        uint256 remainingTokens = project.requiredTokens - project.totalContributed;

        require(tokenAmount <= remainingTokens, "Exceeds remaining tokens");
        require(tokenAmount > 0, "Contribution must be greater than zero");

        // Trasferisce i token dall'utente al contratto
        _transfer(msg.sender, address(this), tokenAmount);
        project.totalContributed += tokenAmount;
        userContributions[projectId][msg.sender] += tokenAmount;

        emit ProjectCompensated(projectId, msg.sender, tokenAmount);

        // Se il progetto raggiunge il target, viene completato
        if (project.totalContributed >= project.requiredTokens) {
            project.active = false;
            _transfer(address(this), project.projectOwner, project.totalContributed);
            emit ProjectCompleted(projectId, project.projectOwner, project.totalContributed);
        }
    }

    // Calcola la percentuale di completamento di un progetto
    function getProjectProgress(uint256 projectId) public view returns (uint256) {
        EcologicProject memory project = projects[projectId];
        if (project.requiredTokens == 0) return 0;
        if (project.totalContributed >= project.requiredTokens) return 100;
        return (project.totalContributed * 100) / project.requiredTokens;
    }

    // Permette agli utenti di acquistare un badge
    function buyBadge(uint256 badgeId) public {
        CircularityBadge storage badgeToRedeem = badge[badgeId];

        require(badgeId > 0 && badgeId <= badgeCounter, "Invalid badge ID");
        require(balanceOf(msg.sender) >= badgeToRedeem.requiredTokens, "Insufficient tokens");
        require(!hasBadge[msg.sender][badgeToRedeem.name], "Already Redeemed");
        require(hasAllPreviousLevels(msg.sender, badgeToRedeem.level), "You have to get the lower level badges first");


        // Trasferisce i token dall'utente al contratto
        _transfer(msg.sender, address(this), badgeToRedeem.requiredTokens);
        hasBadge[msg.sender][badgeToRedeem.name] = true;
        hasBadgeLevel[msg.sender][badgeToRedeem.level] = true;

        emit badgeRedeemed(badgeId, msg.sender);
    }

    // Permette agli utenti di acquistare un corso
    function buyCourse(uint256 courseId) public {
        Course storage course = courses[courseId];

        require(courseId > 0 && courseId <= courseCounter, "Invalid course ID");
        require(balanceOf(msg.sender) >= course.requiredTokens, "Insufficient tokens");
        require(!hasCourse[msg.sender][course.name], "Already Redeemed"); 
        require(msg.sender != course.courseOwner, "The promoter cannot purchase his own course.");

        // Trasferisce i token dall'utente al proprietario del corso
        _transfer(msg.sender, course.courseOwner, course.requiredTokens);
        hasCourse[msg.sender][course.name] = true;

        emit courseCompleted(courseId, course.courseOwner, msg.sender);
    }

    function hasAllPreviousLevels(address user, uint256 level) internal view returns (bool) {
        if (level <= 1) return true;
        for (uint256 i = 1; i < level; i++) {
            if (!hasBadgeLevel[user][i]) {
                return false;
            }
        }
        return true;
    }

    // Permette al proprietario del contratto di prelevare gli ETH accumulati
    function withdraw() public onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}