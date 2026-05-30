import "./styles.css";
import { App } from "./app/App";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Missing #app root element.");
}

const app = new App(root, () => {
  root.innerHTML = `
    <main class="shell">
      <section class="panel">
        <h1>房间已连接</h1>
        <p>下一步会启动 Babylon.js 3D 场景。</p>
      </section>
    </main>
  `;
});

app.mount();
