
const questionBank = [
  {
    category: "Indian Cuisine",
    question: "Which Indian dish is traditionally made with fermented rice and lentil batter?",
    options: ["Dosa", "Naan", "Samosa", "Paratha"],
    answer: 0,
    explanation: "Dosa is prepared using fermented rice and lentil batter."
  },
  {
    category: "World Cuisine",
    question: "Which country is traditionally associated with sushi?",
    options: ["Thailand", "Japan", "China", "Vietnam"],
    answer: 1,
    explanation: "Sushi is a traditional Japanese dish."
  },
  {
    category: "Food Ingredients",
    question: "What is the main ingredient in guacamole?",
    options: ["Cucumber", "Avocado", "Spinach", "Peas"],
    answer: 1,
    explanation: "Guacamole is primarily made from mashed avocado."
  },
  {
    category: "Indian Cuisine",
    question: "Which state is especially famous for Hyderabadi biryani?",
    options: ["Kerala", "Punjab", "Telangana", "Gujarat"],
    answer: 2,
    explanation: "Hyderabadi biryani is closely associated with Hyderabad, Telangana."
  },
  {
    category: "Desserts",
    question: "Which dessert is traditionally made with mascarpone and coffee?",
    options: ["Cheesecake", "Tiramisu", "Brownie", "Panna Cotta"],
    answer: 1,
    explanation: "Tiramisu is an Italian dessert made with coffee-soaked ladyfingers and mascarpone."
  },
  {
    category: "World Cuisine",
    question: "What is the primary ingredient in traditional hummus?",
    options: ["Kidney Beans", "Potatoes", "Chickpeas", "Rice"],
    answer: 2,
    explanation: "Hummus is made mainly from cooked chickpeas."
  },
  {
    category: "Food Facts",
    question: "Which spice gives many curry dishes their yellow colour?",
    options: ["Turmeric", "Cinnamon", "Black Pepper", "Clove"],
    answer: 0,
    explanation: "Turmeric contains curcumin, which gives it a bright yellow colour."
  },
  {
    category: "Italian Cuisine",
    question: "Which type of pasta has a bow-tie shape?",
    options: ["Penne", "Farfalle", "Spaghetti", "Rigatoni"],
    answer: 1,
    explanation: "Farfalle is the Italian name for bow-tie-shaped pasta."
  },
  {
    category: "Beverages",
    question: "Which drink is traditionally prepared using espresso and steamed milk?",
    options: ["Lemonade", "Latte", "Iced Tea", "Milkshake"],
    answer: 1,
    explanation: "A latte combines espresso with steamed milk."
  },
  {
    category: "Indian Cuisine",
    question: "What is the main ingredient in paneer?",
    options: ["Soybeans", "Milk", "Wheat", "Coconut"],
    answer: 1,
    explanation: "Paneer is a fresh cheese made by curdling milk."
  },
  {
    category: "Food Facts",
    question: "Which fruit is commonly dried to produce raisins?",
    options: ["Apple", "Grape", "Mango", "Plum"],
    answer: 1,
    explanation: "Raisins are dried grapes."
  },
  {
    category: "World Cuisine",
    question: "Which country is most closely associated with tacos?",
    options: ["Mexico", "Italy", "Greece", "France"],
    answer: 0,
    explanation: "Tacos are a traditional Mexican food."
  },
  {
    category: "Desserts",
    question: "Which ingredient is essential for making traditional chocolate?",
    options: ["Cocoa", "Coffee", "Vanilla", "Caramel"],
    answer: 0,
    explanation: "Chocolate is made using ingredients derived from cocoa beans."
  },
  {
    category: "Indian Cuisine",
    question: "Which popular Indian street food contains a hollow crispy puri filled with flavoured water?",
    options: ["Vada Pav", "Pani Puri", "Pav Bhaji", "Dhokla"],
    answer: 1,
    explanation: "Pani puri consists of hollow crispy puris filled with flavoured water and other fillings."
  },
  {
    category: "Food Ingredients",
    question: "Which ingredient is commonly used to make tofu?",
    options: ["Almonds", "Soybeans", "Chickpeas", "Corn"],
    answer: 1,
    explanation: "Tofu is made from coagulated soy milk."
  },
  {
    category: "World Cuisine",
    question: "Which country is traditionally associated with paella?",
    options: ["Spain", "Portugal", "Brazil", "Argentina"],
    answer: 0,
    explanation: "Paella is a rice dish originating from Valencia, Spain."
  },
  {
    category: "Food Facts",
    question: "Which part of a plant is a carrot?",
    options: ["Leaf", "Flower", "Root", "Seed"],
    answer: 2,
    explanation: "A carrot is an edible root vegetable."
  },
  {
    category: "Desserts",
    question: "Which dessert is made from deep-fried dough balls soaked in sugar syrup?",
    options: ["Rasgulla", "Gulab Jamun", "Kulfi", "Kheer"],
    answer: 1,
    explanation: "Gulab jamun is made from fried dough balls soaked in sweet syrup."
  },
  {
    category: "World Cuisine",
    question: "What is the main ingredient in traditional pesto alla Genovese?",
    options: ["Basil", "Mint", "Coriander", "Parsley"],
    answer: 0,
    explanation: "Traditional pesto alla Genovese uses fresh basil."
  },
  {
    category: "Food Facts",
    question: "Which grain is used to make traditional popcorn?",
    options: ["Rice", "Wheat", "Corn", "Barley"],
    answer: 2,
    explanation: "Popcorn is made from a special variety of corn kernels."
  }
];

const totalQuestions = 5;

const quizCard = document.getElementById("quiz-card");
const questionCount = document.getElementById("question-count");
const scoreDisplay = document.getElementById("score-display");
const progressFill = document.getElementById("progress-fill");

let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let answered = false;

function shuffleArray(items) {
  const shuffled = [...items];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const randomIndex = Math.floor(Math.random() * (i + 1));

    [shuffled[i], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[i]
    ];
  }

  return shuffled;
}

function startQuiz() {
  questions = shuffleArray(questionBank).slice(0, totalQuestions);
  currentQuestionIndex = 0;
  score = 0;
  answered = false;

  showQuestion();
}

function showQuestion() {
  answered = false;

  const currentQuestion = questions[currentQuestionIndex];

  questionCount.textContent = `QUESTION ${currentQuestionIndex + 1} OF ${totalQuestions}`;
  scoreDisplay.textContent = `SCORE: ${score}`;
  progressFill.style.width = `${(currentQuestionIndex / totalQuestions) * 100}%`;

  quizCard.innerHTML = "";

  const category = document.createElement("span");
  category.className = "question-category";
  category.textContent = currentQuestion.category;

  const title = document.createElement("h2");
  title.className = "question-title";
  title.textContent = currentQuestion.question;

  const optionsContainer = document.createElement("div");
  optionsContainer.className = "options";

  currentQuestion.options.forEach((option, index) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "option-button";

    const letter = document.createElement("span");
    letter.className = "option-letter";
    letter.textContent = String.fromCharCode(65 + index);

    const optionText = document.createElement("span");
    optionText.textContent = option;

    button.append(letter, optionText);

    button.addEventListener("click", () => {
      selectAnswer(index);
    });

    optionsContainer.appendChild(button);
  });

  const feedback = document.createElement("p");
  feedback.className = "feedback";
  feedback.id = "answer-feedback";
  feedback.setAttribute("aria-live", "polite");

  const actions = document.createElement("div");
  actions.className = "quiz-actions";

  const nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.className = "primary-button";
  nextButton.id = "next-question";
  nextButton.textContent = currentQuestionIndex === totalQuestions - 1
    ? "See Results →"
    : "Next Question →";
  nextButton.disabled = true;

  nextButton.addEventListener("click", nextQuestion);

  actions.appendChild(nextButton);

  quizCard.append(
    category,
    title,
    optionsContainer,
    feedback,
    actions
  );
}

function selectAnswer(selectedIndex) {
  if (answered) {
    return;
  }

  answered = true;

  const currentQuestion = questions[currentQuestionIndex];
  const isCorrect = selectedIndex === currentQuestion.answer;

  if (isCorrect) {
    score++;
  }

  const optionButtons = quizCard.querySelectorAll(".option-button");

  optionButtons.forEach((button, index) => {
    button.disabled = true;

    if (index === currentQuestion.answer) {
      button.classList.add("correct");
    } else if (index === selectedIndex) {
      button.classList.add("incorrect");
    }
  });

  const feedback = document.getElementById("answer-feedback");

  feedback.className = isCorrect
    ? "feedback success"
    : "feedback error";

  feedback.textContent = isCorrect
    ? `Correct! ${currentQuestion.explanation}`
    : `Not quite. ${currentQuestion.explanation}`;

  scoreDisplay.textContent = `SCORE: ${score}`;

  document.getElementById("next-question").disabled = false;
}

function nextQuestion() {
  if (!answered) {
    return;
  }

  currentQuestionIndex++;

  if (currentQuestionIndex >= totalQuestions) {
    showResults();
    return;
  }

  showQuestion();
}

function showResults() {
  questionCount.textContent = "QUIZ COMPLETED";
  scoreDisplay.textContent = `FINAL SCORE: ${score}`;
  progressFill.style.width = "100%";

  let heading = "";
  let message = "";

  if (score === 5) {
    heading = "You're a true foodie!";
    message = "A perfect score! Your food knowledge is seriously impressive.";
  } else if (score >= 3) {
    heading = "You've got great taste!";
    message = "Well done! You know your way around the world of food.";
  } else {
    heading = "Keep exploring flavours!";
    message = "Every great foodie starts somewhere. Try another round and discover more.";
  }

  quizCard.innerHTML = `
    <div class="result-card">
      <p class="result-label">YOUR FOODIE RESULTS</p>
      <h2>${heading}</h2>
      <div class="result-score">${score}<span> / ${totalQuestions}</span></div>
      <p class="result-description">${message}</p>
      <div class="result-actions">
        <button type="button" class="primary-button" id="play-again">
          Play Again
        </button>
        <a href="../Dashboard/index.html" class="secondary-button">
          Back to Dashboard
        </a>
      </div>
    </div>
  `;

  document.getElementById("play-again").addEventListener("click", startQuiz);
}

startQuiz();
