const logEl = document.getElementById('log');
const x_super_properties = "eyJvcyI6IldpbmRvd3MiLCJicm93c2VyIjoiQ2hyb21lIiwiZGV2aWNlIjoiIiwic3lzdGVtX2xvY2FsZSI6ImVuLVVTIiwiaGFzX2NsaWVudF9tb2RzIjpmYWxzZSwiYnJvd3Nlcl91c2VyX2FnZW50IjoiTW96aWxsYS81LjAgKFdpbmRvd3MgTlQgMTAuMDsgV2luNjQ7IHg2NCkgQXBwbGVXZWJLaXQvNTM3LjM2IChLSFRNTCwgbGlrZSBHZWNrbykgQ2hyb21lLzEzNC4wLjAuMCBTYWZhcmkvNTM3LjM2IiwiYnJvd3Nlcl92ZXJzaW9uIjoiMTM0LjAuMC4wIiwib3NfdmVyc2lvbiI6IjEwIiwicmVmZXJyZXIiOiJodHRwczovL2Rpc2NvcmQuY29tIiwicmVmZXJyaW5nX2RvbWFpbiI6ImRpc2NvcmQuY29tIiwicmVmZXJyZXJfY3VycmVudCI6IiIsInJlZmVycmluZ19kb21haW5fY3VycmVudCI6IiIsInJlbGVhc2VfY2hhbm5lbCI6InN0YWJsZSIsImNsaWVudF9idWlsZF9udW1iZXIiOjM4NDg4NywiY2xpZW50X2V2ZW50X3NvdXJjZSI6bnVsbH0=";

// ログ出力: タイムスタンプ付きで表示＆スクロール
function appendLog(text) {
  const time = new Date().toLocaleTimeString();
  logEl.textContent += `\n${time} - ${text}`;
  logEl.scrollTop = logEl.scrollHeight;
}

// ログクリア
function clearLog() {
  logEl.textContent = '';
}

// スパム停止フラグ
let shouldStopSpam = false;

 
const tokensInput       = document.getElementById('tokens');
const guildInput        = document.getElementById('guildId');
const channelInput      = document.getElementById('channelIds');

const randomizeCheckbox = document.getElementById('randomize');
const allmentionCheckbox = document.getElementById('allmention');
const delayInput        = document.getElementById('delay');
const limitInput        = document.getElementById('limit');
const mentionInput      = document.getElementById('mentionIds');
const pollTitleInput    = document.getElementById('pollTitle');
const pollAnswersInput  = document.getElementById('pollAnswers');
const autoFillBtn       = document.getElementById('autoFillChannels');
const fetchMentionsBtn  = document.getElementById('fetchMentions');
const submitBtn         = document.getElementById('submitBtn');
const stopBtn           = document.getElementById('stopSpam');
const leaveBtn          = document.getElementById('leaveBtn');
const commandSpamCheckbox = document.getElementById('commandSpam');
const mentionCountInput   = document.getElementById('mentionCount');
const form              = document.getElementById('form');


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 入力文字列をカンマまたは改行で分割し、空要素・重複を排除する
function parseList(input) {
  const arr = input.split(/[\s,]+/)
    .map(s => s.trim())
    .filter(s => s);
  return [...new Set(arr)];
}

async function leaveGuild(token, guildId) {
	const res = await fetch(`https://discord.com/api/v9/users/@me/guilds/${guildId}`, {
		method: 'DELETE',
		headers: { 'Authorization': token , 'Content-Type': 'application/json' , 'x-super-properties': x_super_properties },
    body: JSON.stringify({"lurking":false}),
    referrerPolicy: "no-referrer"
	});
	if (res.status === 204) appendLog(`✅ 退出成功: ${token.slice(0, 10)}*****`);
	else appendLog(`❌ ${token.slice(0, 10)}***** - 退出失敗(${JSON.stringify(await res.json())})`);
}

// チャンネル自動取得
autoFillBtn.addEventListener('click', async () => {
	clearLog();
	const tokens = parseList(tokensInput.value);
	const guildId = guildInput.value.trim();
	if (!tokens.length) return appendLog('⚠️ トークンを入力してください');
	if (!guildId) return appendLog('⚠️ サーバーIDを入力してください');

	try {
		const res = await fetch(`https://discord.com/api/v9/guilds/${guildId}/channels`, {
			headers: {
				Authorization: tokens[0],
				'Content-Type': 'application/json',
				'x-super-properties': x_super_properties
			},
			referrerPolicy: "no-referrer"
		});
		if (!res.ok) throw new Error(JSON.stringify(await res.json()));

		const channels = await res.json();

		// --- ロール一覧を取得 ---
		const roleRes = await fetch(`https://discord.com/api/v9/guilds/${guildId}/roles`, {
			headers: { Authorization: tokens[0] }
		});
		const roles = await roleRes.json();
		const rolesMap = Object.fromEntries(roles.map(r => [r.id, r]));

		// --- 管理者専用チャンネルを除外して取得 ---
		const filtered = channels.filter(ch => {
			if (ch.type !== 0) return false; // テキストチャンネルのみ
			return !isAdminOnlyChannel(ch, rolesMap);
		});

		if (!filtered.length) return appendLog('チャンネルが見つかりません');

		channelInput.value = filtered.map(ch => ch.id).join(',');
		appendLog(`✅ ${filtered.length} 件のチャンネルを取得（管理者専用を除外）`);
	} catch (e) {
		appendLog(`❌ ${tokens[0].slice(0, 10)}***** - エラー：${e.message}`);
	}
});

// --- 管理者専用判定関数（JS版） ---
function isAdminOnlyChannel(channel, roles) {
	const overwrites = channel.permission_overwrites || [];
	const SEND_MESSAGES = 0x00000800;
	const ADMINISTRATOR = 0x00000008;

	const allowedRoles = overwrites
		.filter(ow => ow.type === 0 && (parseInt(ow.allow, 10) & SEND_MESSAGES))
		.map(ow => ow.id);

	if (!allowedRoles.length) return false;

	for (const roleId of allowedRoles) {
		const role = roles[roleId];
		if (!role) continue;
		if (!(parseInt(role.permissions, 10) & ADMINISTRATOR)) {
			return false;
		}
	}
	return true;
}

// メンション取得
fetchMentionsBtn.addEventListener('click', async () => {
  clearLog();
  const tokens     = parseList(tokensInput.value);
  const guildId    = guildInput.value.trim();
  const channelIds = parseList(channelInput.value);
  if (!tokens.length)    return appendLog('⚠️ トークンを入力してください');
  if (!guildId)         return appendLog('⚠️ サーバーIDを入力してください');
  if (!channelIds.length) return appendLog('⚠️ チャンネルIDを入力してください');
  const ws = new WebSocket('wss://gateway.discord.gg/?v=9&encoding=json');
  ws.onopen = () => {
    ws.send(JSON.stringify({ op: 2, d: { token: tokens[0], properties: { os: 'Windows', browser: 'Discord', device: 'pc' }, intents: 1 << 12 } }));
  };
  ws.onmessage = event => {
    const msg = JSON.parse(event.data);
    if (msg.op === 0 && msg.t === 'READY') {
      ws.send(JSON.stringify({ op: 14, d: { guild_id: guildId, typing: false, activities: false, threads: true, channels: { [channelIds[0]]: [[0, 0]] } } }));
    }
    if (msg.t === 'GUILD_MEMBER_LIST_UPDATE') {
      const mentions = msg.d.ops[0].items.filter(i => i.member).map(i => i.member.user.id);
      if (mentions.length) { mentionInput.value = mentions.join(','); appendLog('✅ メンション取得完了'); }
      else appendLog('メンションが見つかりません');
      ws.close();
    }
  };
  ws.onerror = () => { appendLog('❌ WebSocketエラー'); ws.close(); };
});

async function authenticateOnly(token) {
	return new Promise((resolve) => {
		const ws = new WebSocket('wss://gateway.discord.gg/?v=9&encoding=json');

		ws.onopen = () => {
			ws.send(JSON.stringify({
				op: 2,
				d: {
					token,
					properties: {
						os: 'Windows',
						browser: 'Discord',
						device: 'pc'
					},
					intents: 0
				}
			}));
		};

		ws.onmessage = (event) => {
			const msg = JSON.parse(event.data);
			if (msg.t === 'READY') {
				appendLog(`✅ 認証完了: ${token.slice(0, 10)}*****`);
				ws.close();
				resolve(true);
			} else if (msg.t === 'INVALID_SESSION') {
				appendLog(`❌ 認証失敗: ${token.slice(0, 10)}*****`);
				ws.close();
				resolve(false);
			}
		};

		ws.onerror = () => {
			appendLog(`❌ WebSocket エラー: ${token.slice(0, 10)}*****`);
			ws.close();
			resolve(false);
		};

		ws.onclose = () => {
			// 応答なしで切れた場合もフォールバック
			resolve(false);
		};
	});
}

// ▼▼▼ この関数をまるごと差し替える ▼▼▼
async function sendMessage(token, channelId, content, opts = {}) {
    const headers = { 'Authorization': token, 'Content-Type': 'application/json', 'x-super-properties': x_super_properties };
    let body = { content: content || '' };

    // 1. コマンド荒らしのプレフィックス
    if (opts.commandSpam) {
      body.content = `!help ${body.content}`;
    }

    // 2. ランダマイズ
    if (opts.randomize) {
      body.content += `\n${crypto.randomUUID()}`;
    }

    // 3. 全体メンション
    if (opts.allmention) {
      body.content = `@everyone\n${body.content}`;
    }

    // 4. ランダムメンション (★末尾に移動 ＆ 複数対応)
    if (opts.randomMentions && opts.randomMentions.length > 0) {
      const count = opts.mentionCount || 1; // デフォルト1人
      let mentions = [];
      let availableMentions = [...opts.randomMentions]; // 元の配列を壊さないようコピー

      for (let i = 0; i < count; i++) {
        if (availableMentions.length === 0) break; // メンションリストが枯渇したら終了
        
        // ランダムなインデックスを選び、リストからIDを取得・削除 (重複防止)
        const randomIndex = Math.floor(Math.random() * availableMentions.length);
        const id = availableMentions.splice(randomIndex, 1)[0]; 
        mentions.push(`<@${id}>`);
      }
      
      if (mentions.length > 0) {
        // (★) ご提示のファイルのロジックを採用
        if (body.content) {
            body.content += `\n${mentions.join(' ')}`;
        } else {
            body.content = mentions.join(' ');
        }
      }
    }
    
    // 5. 投票
    if (opts.pollTitle && opts.pollAnswers) {
      body.poll = { question: { text: opts.pollTitle }, answers: opts.pollAnswers.map(a => ({ poll_media: { text: a.trim() } })), allow_multiselect: false, duration: 1, layout_type: 1 };
    }
  
    const res = await fetch(`https://discord.com/api/v9/channels/${channelId}/messages`, { method: 'POST', headers, body: JSON.stringify(body), referrerPolicy: "no-referrer" });
    return res;  // レスポンスを返す
}
// ▲▲▲ ここまで差し替え ▲▲▲

// 再試行ロジックを外で実行
async function sendMessageWithRetry(token, channelId, content, opts = {}, maxRetries = 5, delayTime = 3000) {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            const res = await sendMessage(token, channelId, content, opts);
            if (res.ok) {
                appendLog(`✅ ${token.slice(0, 10)}***** - メッセージ送信成功`);
                return true;
            } else if (res.status === 429) {
                const jd = await res.json();
                const wait = (jd?.retry_after || 1) * 1000;
                appendLog(`⏳  ${token.slice(0, 10)}***** - レート制限: ${wait / 1000}s`);
                await sleep(wait);
                attempt++;
            } else if (res.status === 400) {
              const errorData = await res.json();
              appendLog(`❌ ${token.slice(0, 10)}***** - 送信エラー(${res.status}): ${JSON.stringify(errorData) || '詳細不明'}`);
              authtest = await authenticateOnly(token);
              if (!authtest) return false;
            } else {
                const errorData = await res.json();
                appendLog(`❌ ${token.slice(0, 10)}***** - 送信エラー(${res.status}): ${JSON.stringify(errorData) || '詳細不明'}`);
                return false;
            }
        } catch (e) {
            appendLog(`⚠️ ${token.slice(0, 10)}***** - エラー: ${e.message} | 再試行中...`);
            await sleep(delayTime);
            attempt++;
        }
    }
    appendLog(`❌ トークン(${token.slice(0, 10)}) 最大リトライ回数に達しました。`);
    return false;
}

// 入力が未入力の場合、ボタンを無効化
function checkFormValidity() {
  const tokens = tokensInput.value.trim();
  const guildId = guildInput.value.trim();
  //const message = messageInput.value.trim();
  submitBtn.disabled = !(tokens && guildId);
}

// 入力フィールドの変更時にチェック
tokensInput.addEventListener('input', checkFormValidity);
guildInput.addEventListener('input', checkFormValidity);
//messageInput.addEventListener('input', checkFormValidity);

// 初期状態でフォームの有効性をチェック
checkFormValidity();

// スパム実行
form.addEventListener('submit', async e => {
    e.preventDefault();
    const messageInput      = document.querySelector('input[name="messageOption"]:checked');
    // メッセージがAの場合
    let message;
    if (messageInput.value === 'A') {
        message = `# Raid by Ozeu !!!
# join now !!!!!!!
## おぜうの集い万歳！今すぐ参加しよう
https://imgur.com/a/SKq5qWB
https://i.imgur.com/tJaVqlH.mp4
https://discord.gg/acvr`
    }
    else if (messageInput.value === 'B') {
        message = `# おぜうの集いに今すぐ参加！
## https://\/\/\ｃ͏a͏ｎ͏a͏ｒ͏ｙ͏。͏𝑑͏𝓲͏Ｓ͏𝐜͏𝑜͏ｒ͏ᵈ͏Ａ͏pＰ͏。͏𝐜͏𝑜͏ｍ͏\google.com⁂⌘∮/%2e.\../%69%6e%76%69%74%65\youtube.com‖∠∇\../\../\../white_check_marktwitter.com]「＠\../\../\../\../acvr
-# [gif](https://𝕚͏𝕞͏𝕘͏𝕦͏𝕣͏.͏𝕔͏𝕠͏𝕞͏/yNx4Me2)
-# [gif](https://imgur.com/a/5OKmtuG)
|| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| |||| ||`
    }
    else if (messageInput.value === 'C') {
        message = `# ozeu on top
# join now
https://x.gd/QxGd1`
    }
    if (!message) {
        appendLog('⚠️ メッセージ内容が入力されていません');
        return;  // 処理を終了
    }

    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    submitBtn.textContent = '実行中...';
    shouldStopSpam = false;
    stopBtn.disabled = false;
  
    const tokens      = parseList(tokensInput.value);
    const guildId     = guildInput.value.trim();
    const channelIds  = parseList(channelInput.value);
    const randomize   = randomizeCheckbox.checked;
    const allmention  = allmentionCheckbox.checked;
    const commandSpam = commandSpamCheckbox.checked;
    const delay       = parseFloat(delayInput.value) || 0;
    const limit       = limitInput.value.trim() ? parseInt(limitInput.value) : Infinity;
    const mentionArr  = mentionInput.value.trim() ? parseList(mentionInput.value) : null;
    const mentionCount = parseInt(mentionCountInput.value, 10) || 1;
    const pollTitle   = pollTitleInput.value.trim() || null;
    const pollAnswers = pollAnswersInput.value.trim() ? parseList(pollAnswersInput.value) : null;
  
    let totalCount = 0;
  
    const tasks = tokens.map(token => {
      return async () => {
        // 各トークン（タスク）専用のチャンネルIDリストのコピーを作成
        let localChannelIds = [...channelIds];
        let channelIndex = 0;

        // トークンごとに、メッセージ送信を続ける
        while (!shouldStopSpam && totalCount < limit) {
          // このトークンが使えるチャンネルがもうない場合はループを終了
          if (localChannelIds.length === 0) {
            appendLog(`❌ 利用可能なチャンネル無し: ${token.slice(0, 10)}*****`);
            break;
          }

          // チャンネルリストの末尾まで来たら、インデックスを最初に戻す
          if (channelIndex >= localChannelIds.length) {
            channelIndex = 0;
          }

          const channelId = localChannelIds[channelIndex];
          const success = await sendMessageWithRetry(token, channelId, message, {
              randomize,
              randomMentions: mentionArr,
              pollTitle,
              pollAnswers,
              allmention,
              commandSpam,
              mentionCount
          });

          if (success) {
            totalCount++; // 送信成功時にカウントを増加
            channelIndex++; // 成功したので、次のチャンネルへ
          } else {
            // 送信に失敗した場合、リストからそのチャンネルIDを削除
            //appendLog(`⚠️ チャンネル ${channelId} への送信に失敗したため、リストから削除します。`);
            localChannelIds.splice(channelIndex, 1);
            // ★重要：要素を削除したため、インデックスはインクリメントしない
            // (次のループで、削除された位置にずれてきた新しい要素を処理するため)
          }
          
          if (totalCount >= limit) {
            appendLog('✅ 指定数に達しました');
            break; // 指定回数に達したら終了
          }

          if (delay) {
            await sleep(delay * 1000);
          }
        }
      };
    });
  
    // 各トークンについて並列でタスクを実行
    await Promise.all(tasks.map(task => task()));
  
    submitBtn.disabled = false;
    submitBtn.classList.remove('loading');
    stopBtn.disabled = true;
    submitBtn.textContent = '実行';
    appendLog('✅ 完了');
});


// 停止ボタンリスナー
stopBtn.addEventListener('click', () => {
  shouldStopSpam = true;
  appendLog('🛑 スパムを停止します...')
  submitBtn.disabled = false; submitBtn.classList.remove('loading') ; submitBtn.textContent = '実行';
});

// 退出ボタンリスナー
leaveBtn.addEventListener('click', async () => {
  shouldStopSpam = true; stopBtn.disabled = true; appendLog('🛑 スパムを停止します...');
  const tokens  = parseList(tokensInput.value);
  const guildId = guildInput.value.trim();
  if (!tokens.length) return appendLog('⚠️ トークンを入力してください');
  if (!guildId) return appendLog('⚠️ サーバーIDを入力してください');
  for (const token of tokens) await leaveGuild(token, guildId);
  appendLog('✅ 退出処理完了');
  submitBtn.disabled = false; submitBtn.classList.remove('loading') ; submitBtn.textContent = '実行';
});
