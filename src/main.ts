import "./styles.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root element.");
}

app.innerHTML = `
  <main class="shell">
    <section class="panel">
      <h1>CS-Lite Web v0.1</h1>
      <p>项目脚手架已启动。下一步会加入房间、3D 场景和同步。</p>
    </section>
  </main>
`;
