import "./styles.css";
import { App } from "./app/App";
import { ClientGame } from "./game/ClientGame";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Missing #app root element.");
}

let activeGame: ClientGame | null = null;

const app = new App(root, (network) => {
  activeGame?.dispose();
  activeGame = new ClientGame(root, network);
  activeGame.start();
});

app.mount();
