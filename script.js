const container = document.querySelector(".container");
const chatsContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = promptForm.querySelector(".prompt-input");
const fileInput = promptForm.querySelector("#file-input");
const fileUploadWrapper = promptForm.querySelector(".file-upload-wrapper");
const themeToggle = document.querySelector("#theme-toggle-btn");

// API key and URL for the Gemini model
const API_KEY = "AIzaSyDzR_L2ESE4ziISaN9HlnE8U_i4ONjFwec";
const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

let typingInterval, controller;
let UserData = { message: "", file: {} };
const chatHistory = [];

// Function to create a message element
const createMsgElement = (content, ...classes) => {
  const div = document.createElement("div");
  div.classList.add("message", ...classes);
  div.innerHTML = content;
  return div;
};

// scroll to the bottom of the container
const scrollToBottom = () =>
  container.scrollTo({
    top: container.scrollHeight,
    behavior: "smooth",
  });

// Simulate typing effect for the bot's response
const typingEffect = (Text, textElement, botMsgHtml) => {
  textElement.textContent = "";
  const words = Text.split(" ");
  let wordIndex = 0;

  // set an interval to type each word.
  typingInterval = setInterval(() => {
    if (wordIndex < words.length) {
      textElement.textContent +=
        (wordIndex === 0 ? "" : " ") + words[wordIndex];
      wordIndex++;
      scrollToBottom();
    } else {
      clearInterval(typingInterval);
      botMsgHtml.classList.remove("loading");
      document.body.classList.remove("bot-responding");
    }
  }, 40);
};

// Make API call to generate a response from the Gemini model
const generateResponse = async (botMsgHtml) => {
  const textElement = botMsgHtml.querySelector(".message-text");
  controller = new AbortController();
  //  Add the user's message to the chat history
  chatHistory.push({
    role: "user",
    parts: [
      { text: UserData.message },
      ...(UserData.file.data
        ? [
            {
              inlineData: (({ fileName, isImage, ...rest }) => rest)(
                UserData.file,
              ),
            },
          ]
        : []),
    ],
  });

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ contents: chatHistory }),
      signal: controller.signal,
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("Rate limit exceeded. Try again later.");
      }
      throw new Error(data.error.message || "Failed to generate response");
    }

    // Process the response text and display with typing effect
    const responseText = data.candidates[0].content.parts[0].text
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .trim();
    typingEffect(responseText, textElement, botMsgHtml);
    chatHistory.push({ role: "model", parts: [{ text: responseText }] });
  } catch (error) {
    textElement.style.color = "#d62939";
    textElement.textContent =
      error.name === "AbortError"
        ? "Response generation stopped."
        : error.message;
    botMsgHtml.classList.remove("loading");
    document.body.classList.remove("bot-responding");
    scrollToBottom();
  } finally {
    UserData.file = {};
  }
};

// Handle form submission
const handleFormSubmit = (e) => {
  e.preventDefault();
  const UserMessage = promptInput.value.trim();

  if (!UserMessage || document.body.classList.contains("bot-responding"))
    return;

  promptInput.value = "";
  UserData.message = UserMessage;
  document.body.classList.add("bot-responding", "chat-active");
  fileUploadWrapper.classList.remove("active", "img-attached", "file-attached");

  const userMsgHtml = `
<p class="message-text"></p>
${
  UserData.file.data
    ? UserData.file.isImage
      ? ` <img src="data:${UserData.file.mime_type};base64,${UserData.file.data}" class="img-attachment" />`
      : `<p class="file-attachment"><span
class="material-symbols-rounded">description</span>${UserData.file.fileName}</p>`
    : ""
}`;

  const userMsgDiv = createMsgElement(userMsgHtml, "user-message");

  userMsgDiv.querySelector(".message-text").textContent = UserMessage;
  chatsContainer.appendChild(userMsgDiv);
  scrollToBottom();

  setTimeout(() => {
    // Show loading message while waiting for the response
    const botMsgHtml = `<img src="gemini-color.svg" class="avatar" /> <p class="message-text">Just a sec..</p>`;
    const botMsgDiv = createMsgElement(botMsgHtml, "bot-message", "loading");

    chatsContainer.appendChild(botMsgDiv);
    scrollToBottom();
    generateResponse(botMsgDiv);
  }, 600);
};

// Handle file input change (file upload)
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;

  const isImage = file.type.startsWith("image/");
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = (e) => {
    fileInput.value = "";
    const base64Str = e.target.result.split(",")[1];

    fileUploadWrapper.querySelector(".file-preview").src = e.target.result;
    fileUploadWrapper.classList.add(
      "active",
      isImage ? "img-attached" : "file-attached",
    );

    // store file data in userData obj
    UserData.file = {
      fileName: file.name,
      data: base64Str,
      mime_type: file.type,
      isImage,
    };
  };
});

// Handle Suggestions click
document.querySelectorAll(".suggestions-item").forEach((item) => {
  item.addEventListener("click", () => {
    promptInput.value = item.querySelector(".text").textContent;
    promptForm.dispatchEvent(new Event("submit"));
  });
});

// cancel File
document.querySelector("#cancel-file-btn").addEventListener("click", () => {
  UserData.file = {};
  fileUploadWrapper.classList.remove("active", "img-attached", "file-attached");
});

// Stop ongoing bot response
document.querySelector("#stop-response-btn").addEventListener("click", () => {
  UserData.file = {};
  controller?.abort();
  clearInterval(typingInterval);
  chatsContainer
    .querySelector(".bot-message.loading")
    .classList.remove("loading");
  document.body.classList.remove("bot-responding", "chat-active");
});
// Delete All Chats
document.querySelector("#delete-chats-btn").addEventListener("click", () => {
  chatHistory.length = 0;
  chatsContainer.innerHTML = "";
  document.body.classList.remove("bot-responding");
});

// Show/hide controls for mobile on prompt input focus
document.addEventListener("click", ({ target }) => {
  const wrapper = document.querySelector(".prompt-wrapper");

  const shouldHide =
    target.classList.contains("prompt-input") ||
    (wrapper.classList.contains("hide-controls") &&
      (target.id === "add-file-btn" || target.id === "stop-response-btn"));

  wrapper.classList.toggle("hide-controls", shouldHide);
});

// toggle dark/light theme
themeToggle.addEventListener("click", () => {
  const isLightTheme = document.body.classList.toggle("light-theme");
  localStorage.setItem("themeColor", isLightTheme ? "light_mode" : "dark_mode");
  themeToggle.textContent = isLightTheme ? "dark_mode" : "light_mode";
});

// set initial theme from local storage
const isLightTheme = localStorage.getItem("themeColor") === "light_mode";
document.body.classList.toggle("light-theme", isLightTheme);
themeToggle.textContent = isLightTheme ? "dark_mode" : "light_mode";

promptForm.addEventListener("submit", handleFormSubmit);

promptForm
  .querySelector("#add-file-btn")
  .addEventListener("click", () => fileInput.click());
