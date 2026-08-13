/**
 * mcp.js — MCP (Model Context Protocol) 工具定义 + AI 面板逻辑
 *
 * 暴露游戏状态查询、射击建议、ZK 证明解释、战局复盘等工具，
 * 供游戏内 AI 助手面板调用，也可供外部 MCP 客户端接入。
 *
 * 工具列表:
 *   - get_battlefield:  获取当前战局状态
 *   - suggest_move:     推荐最佳射击位置（概率分析）
 *   - explain_proof:    解释最近一条 ZK 证明
 *   - battle_review:    生成战局复盘报告
 *   - fire_at:          在指定位置开火（通过 MCP 操控游戏）
 */

import { state, GRID_SIZE, TOTAL_SHIP_CELLS, SHIPS } from "./state-mcp.js";

// ===== 工具注册表 =====
export const MCP_TOOLS = {
  /**
   * 获取当前战局状态
   */
  get_battlefield: {
    description: "获取当前战局状态 / Get current battlefield state",
    handler() {
      return {
        phase: state.phase,
        turn: state.currentTurn,
        player: {
          shipsRemaining: state.playerShipsRemaining,
          totalShips: TOTAL_SHIP_CELLS,
        },
        opponent: {
          shipsRemaining: state.opponentShipsRemaining,
          totalShips: TOTAL_SHIP_CELLS,
        },
        zk: {
          enabled: state.zkEnabled,
          proofsGenerated: state.zkStats.proofsGenerated,
          proofsVerified: state.zkStats.proofsVerified,
          proofsFallback: state.zkStats.proofsFallback,
        },
        combo: state.combo || 0,
        difficulty: state.difficulty || "normal",
      };
    },
  },

  /**
   * 推荐最佳射击位置
   * 策略：命中格的相邻格优先（target模式），未命中格按奇偶概率打分
   */
  suggest_move: {
    description: "推荐最佳射击位置 / Suggest best firing position",
    handler() {
      if (state.phase !== "battle") return { error: "当前非战斗阶段" };
      if (state.currentTurn !== "player") return { error: "当前非你的回合" };

      const cells = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          const bit = r * GRID_SIZE + c;
          if (state.playerShots & (1 << bit)) continue;

          let score = 0;
          let reason = [];

          // 检查相邻格是否已命中 → 高优先
          for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) continue;
            const nbit = nr * GRID_SIZE + nc;
            if (state.playerHits & (1 << nbit)) {
              score += 30;
              reason.push(`相邻格 ${String.fromCharCode(65+nc)}${nr+1} 已命中`);
            }
            if (state.playerShots & (1 << nbit) && !(state.playerHits & (1 << nbit))) {
              score += 5; // 相邻有未命中的 → 该方向不太可能
            }
          }

          // 奇偶模式：偶数格更有可能命中（棋盘覆盖策略）
          if ((r + c) % 2 === 0) {
            score += 10;
            reason.push("偶数格(奇偶策略)");
          }

          // 中心区域更有价值
          const centerDist = Math.abs(r - 2) + Math.abs(c - 2);
          score += (4 - centerDist) * 2;

          // 随机扰动
          score += Math.random() * 3;

          cells.push({
            row: r,
            col: c,
            label: `${String.fromCharCode(65+c)}${r+1}`,
            score: Math.round(score),
            reason: reason.join("；") || "常规搜索",
          });
        }
      }

      cells.sort((a, b) => b.score - a.score);
      const top3 = cells.slice(0, 3);

      return {
        suggestions: top3,
        best: top3[0],
        analysis: top3[0] ? `推荐射击 ${top3[0].label}（得分 ${top3[0].score}）：${top3[0].reason}` : "无可射击位置",
      };
    },
  },

  /**
   * 解释最近一条 ZK 证明
   */
  explain_proof: {
    description: "解释最近一条 ZK 证明 / Explain latest ZK proof",
    handler() {
      const last = state.proofLog[0];
      if (!last) return { error: "暂无 ZK 证明记录" };

      const explanations = {
        verify_hit: {
          what: "验证命中/未命中结果正确",
          how: "对船位位串和射击掩码做 bitwise AND，非零=命中，零=未命中",
          privacy: "船位位串是私有输入，ZK 证明验证 AND 运算正确，但不暴露船位",
        },
        verify_victory: {
          what: "验证是否全部战舰被击沉",
          how: "对船位和命中记录做 AND，如果结果等于船位本身，说明全部命中",
          privacy: "船位保持私有，只输出是否全歼的布尔结果",
        },
        verify_scan: {
          what: "雷达扫描：返回区域内战舰格数",
          how: "对船位和扫描区域掩码做 AND，统计结果中 1 的个数",
          privacy: "只返回数量，不暴露具体哪些格有船",
        },
      };

      const info = explanations[last.function] || { what: "未知", how: "未知", privacy: "未知" };

      return {
        function: last.function,
        timestamp: last.timestamp,
        result: last.result,
        isZkProof: last.zkProof,
        proofHash: last.proofHash,
        whatItDoes: info.what,
        howItWorks: info.how,
        privacyGuarantee: info.privacy,
        shipsInput: "🔒 永远加密（私有输入）",
        publicOutput: last.result,
      };
    },
  },

  /**
   * 生成战局复盘报告
   */
  battle_review: {
    description: "生成战局复盘报告 / Generate battle review",
    handler() {
      const s = state.zkStats;
      const hitRate = state.stats?.shots > 0
        ? Math.round(state.stats.hits / state.stats.shots * 100) : 0;
      const verifyRate = s.proofsGenerated > 0
        ? Math.round(s.proofsVerified / s.proofsGenerated * 100) : 0;

      return {
        status: state.winner ? (state.winner === "player" ? "胜利" : "失败") : "进行中",
        zkProofs: {
          total: s.proofsGenerated,
          verified: s.proofsVerified,
          fallback: s.proofsFallback,
          verifyRate: `${verifyRate}%`,
        },
        player: {
          shipsRemaining: state.playerShipsRemaining,
          totalShips: TOTAL_SHIP_CELLS,
        },
        opponent: {
          shipsRemaining: state.opponentShipsRemaining,
          totalShips: TOTAL_SHIP_CELLS,
        },
        verdict: state.winner === "player"
          ? "胜利：分析你的命中策略，寻找最优射击路径"
          : state.winner === "opponent"
          ? "失败：分析防守弱点，考虑调整舰队布局"
          : "进行中：关注命中模式，优先攻击相邻格",
      };
    },
  },

  /**
   * 在指定位置开火（通过 MCP 操控游戏）
   */
  fire_at: {
    description: "在指定位置开火 / Fire at a position",
    handler(row, col) {
      if (state.phase !== "battle") return { error: "当前非战斗阶段" };
      if (state.currentTurn !== "player") return { error: "当前非你的回合" };
      const bit = row * GRID_SIZE + col;
      if (state.playerShots & (1 << bit)) return { error: "该位置已射击" };

      // 触发开火（通过全局函数）
      if (window.fireAt) {
        window.fireAt(row, col);
        return { fired: true, row, col, label: `${String.fromCharCode(65+col)}${row+1}` };
      }
      return { error: "无法执行开火" };
    },
  },
};

/**
 * 调用 MCP 工具
 */
export function callTool(toolName, ...args) {
  const tool = MCP_TOOLS[toolName];
  if (!tool) return { error: `未知工具: ${toolName}` };
  try {
    return tool.handler(...args);
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * 列出所有可用工具（MCP 协议兼容格式）
 */
export function listTools() {
  return Object.entries(MCP_TOOLS).map(([name, def]) => ({
    name,
    description: def.description,
  }));
}

/**
 * 生成 AI 面板内容
 * 根据当前游戏状态自动生成有用的建议
 */
export function generateAIPanel() {
  const battlefield = callTool("get_battlefield");
  const suggestions = callTool("suggest_move");
  const proofInfo = callTool("explain_proof");

  return {
    battlefield,
    suggestions: suggestions.suggestions || [],
    bestMove: suggestions.best || null,
    analysis: suggestions.analysis || "",
    proofInfo: proofInfo.error ? null : proofInfo,
    tools: listTools(),
  };
}
