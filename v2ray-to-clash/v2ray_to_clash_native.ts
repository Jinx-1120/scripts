import * as base64 from "https://denopkg.com/chiefbiiko/base64@master/mod.ts";

async function httpRequest(url: string) {
  try {
    const response = await fetch(url);
    const data = await response.text();
    return data;
  } catch (error) {
    console.error("Failed to fetch subscription content:", error.message);
    return "";
  }
}

async function getV2RayNodes(subscriptionUrl: string) {
  const response = await httpRequest(subscriptionUrl);
  const decodedContent = base64.toUint8Array(
    response.replace(/[^A-Za-z0-9+/=_-]/g, "")
  );
  return new TextDecoder()
    .decode(decodedContent)
    .split("\n")
    .filter((node) => node.trim());
}
interface IVmessNode {
  type: string;
  name: string;
  server: string;
  port: number;
  uuid: string;
  alterId: number;
  cipher: string;
  network: string;
  tls: boolean | string;
  path: string;
  host: string;
}
function parseVmessNode(vmessUrl: string): IVmessNode {
  const [type, infoStr] = vmessUrl.split("://");
  const decodedJson = JSON.parse(
    new TextDecoder().decode(base64.toUint8Array(infoStr))
  );
  return {
    type: type,
    name: decodedJson.ps,
    server: decodedJson.add,
    port: decodedJson.port,
    uuid: decodedJson.id,
    alterId: decodedJson.aid,
    cipher: decodedJson.net,
    network: decodedJson.net,
    tls: decodedJson.tls,
    path: decodedJson.path,
    host: decodedJson.host,
  };
}

function getClashProxies(v2rayNodes: string[]) {
  return v2rayNodes.map((node) => parseVmessNode(node));
}

function convertVmessToClashProxy(vmessNode: IVmessNode) {
  const path = vmessNode.path;
  // delete vmessNode.path;
  return {
    type: vmessNode.type,
    name: vmessNode.name,
    server: vmessNode.server,
    port: vmessNode.port,
    uuid: vmessNode.uuid,
    alterId: vmessNode.alterId,
    cipher: "auto",
    tls: vmessNode.tls === "tls",
    network: vmessNode.network,
    path: path || "",
    "ws-opts": path ? { path: path, headers: { host: vmessNode.server } } : {},
  };
}
function generateClashConfig(proxies: IVmessNode[]) {
  const proxyList = proxies
    .map(convertVmessToClashProxy)
    .map((proxy) => `  - ${JSON.stringify(proxy)}`)
    .join("\n");
  const proxyNames = proxies.map((proxy) => `      - ${proxy.name}`).join("\n");

  const configTemplate = `
port: 7890
socks-port: 7891
allow-lan: true
mode: Rule
log-level: info
external-controller: 9090
proxies:
${proxyList}
proxy-groups:
  - name: 🔰 节点选择
    type: select
    proxies:
      - vpn-eu
      - vpn-sg
${proxyNames}
  - name: ♻️ 自动选择
    type: url-test
    url: http://www.gstatic.com/generate_204
    interval: 300
    proxies:
      - vpn-eu
      - vpn-sg
${proxyNames}
  - name: 🎥 NETFLIX
    type: select
    proxies:
      - 🔰 节点选择
      - ♻️ 自动选择
      - 🎯 全球直连
  - name: ⛔️ 广告拦截
    type: select
    proxies:
      - 🛑 全球拦截
      - 🎯 全球直连
      - 🔰 节点选择
  - name: 🚫 运营劫持
    type: select
    proxies:
      - 🛑 全球拦截
      - 🎯 全球直连
      - 🔰 节点选择
  - name: 🌍 国外媒体
    type: select
    proxies:
      - 🔰 节点选择
      - ♻️ 自动选择
      - 🎯 全球直连
  - name: 🌏 国内媒体
    type: select
    proxies:
      - 🔰 节点选择
      - ♻️ 自动选择
      - 🎯 全球直连
  - name: Ⓜ️ 微软服务
    type: select
    proxies:
      - 🔰 节点选择
      - ♻️ 自动选择
      - 🎯 全球直连
  - name: 📲 电报信息
    type: select
    proxies:
      - 🔰 节点选择
      - ♻️ 自动选择
  - name: 🍎 苹果服务
    type: select
    proxies:
      - 🔰 节点选择
      - 🎯 全球直连
      - ♻️ 自动选择
  - name: 🎯 全球直连
    type: select
    proxies:
      - DIRECT
  - name: 🛑 全球拦截
    type: select
    proxies:
      - REJECT
      - DIRECT
  - name: 🐟 漏网之鱼
    type: select
    proxies:
      - 🔰 节点选择
      - 🎯 全球直连
      - ♻️ 自动选择
`;

  return configTemplate;
}

const args: string[] = Deno.args;

const url = args[args.findIndex((i) => i === "--url") + 1];
if (!args.includes("--url")) {
  throw new Error("url is required");
}
(async function main(v2raySubscriptionUrl: string) {
  const v2rayNodes = await getV2RayNodes(v2raySubscriptionUrl);
  const clashProxies = getClashProxies(v2rayNodes);

  if (clashProxies.length === 0) {
    throw new Error("No v2rayNodes information found");
  }
  const clashConfig = generateClashConfig(clashProxies);

  // 将生成的Clash配置文件保存到本地
  Deno.writeTextFileSync(
    "v2ray_to_clash.yaml",
    clashConfig + "\n" + Deno.readTextFileSync("rules.template")
  );

  console.log("Clash配置文件已生成: v2ray_to_clash.yaml");
})(url);
