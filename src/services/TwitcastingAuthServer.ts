import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 3000;

const clientId = process.env.TWICAS_CLIENT_ID;
const clientSecret = process.env.TWICAS_CLIENT_SECRET;
const redirectUri = process.env.TWICAS_REDIRECT_URI;

app.get('/', (_req, res) => {
  res.send('ツイキャスOAuth2認証サーバーへようこそ！');
});

app.get('/login', (_req, res) => {
  const authUrl = `https://apiv2.twitcasting.tv/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}`;
  res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
  const code = req.query.code as string;
  const tokenUrl = 'https://apiv2.twitcasting.tv/oauth2/access_token';
  
  try {
    const response = await axios.post(
      tokenUrl,
      {
        code,
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    if (response.status === 200) {
      const accessToken = response.data.access_token;
      res.send(`アクセストークン: ${accessToken}<br><br>
        このトークンを.envファイルのTWICAS_ACCESS_TOKENに設定してください。<br>
        TWICAS_ACCESS_TOKEN=${accessToken}`);
    } else {
      res.status(400).send(`エラー: ${response.status} - ${response.statusText}`);
    }
  } catch (error) {
    console.error('トークン取得中にエラーが発生しました:', error);
    res.status(500).send('トークンの取得に失敗しました');
  }
});

export function startAuthServer(): void {
  app.listen(port, () => {
    console.log(`認証サーバーが起動しました: http://localhost:${port}`);
    console.log('アクセストークンを取得するには、以下のURLにアクセスしてください:');
    console.log(`http://localhost:${port}/login`);
  });
} 