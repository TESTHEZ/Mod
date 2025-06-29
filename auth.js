const { randomBytes } = require('crypto');
const faunadb = require('faunadb');
const q = faunadb.query;

// FaunaDB istemcisini başlat
const client = new faunadb.Client({
  secret: process.env.FAUNADB_SECRET,
  domain: 'db.fauna.com'
});

exports.handler = async (event, context) => {
  try {
    const data = JSON.parse(event.body);
    const action = data.action;
    
    // Yönetici girişi
    if (action === 'login') {
      if (data.username === "HEZWIN" && data.password === "HEZWIN123") {
        return {
          statusCode: 200,
          body: JSON.stringify({ success: true })
        };
      } else {
        return {
          statusCode: 401,
          body: JSON.stringify({ error: "Geçersiz kimlik bilgileri" })
        };
      }
    }
    
    // Yeni anahtar oluştur
    if (action === 'generate_key') {
      const keyName = data.keyName;
      const durationHours = parseInt(data.duration);
      
      if (!keyName || !durationHours) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Eksik parametreler" })
        };
      }
      
      // Rastgele anahtar oluştur
      const keyValue = 'HEZWIN-' + randomBytes(8).toString('hex').toUpperCase();
      const createdAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
      
      // FaunaDB'ye kaydet
      await client.query(
        q.Create(q.Collection('keys'), {
          data: {
            key: keyValue,
            name: keyName,
            createdAt,
            expiresAt,
            active: true
          }
        })
      );
      
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true,
          key: keyValue,
          expiresAt
        })
      };
    }
    
    // Anahtar geçerliliğini kontrol et
    if (action === 'check_key') {
      const key = data.key;
      
      if (!key) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Anahtar gereklidir" })
        };
      }
      
      // FaunaDB'de sorgula
      const result = await client.query(
        q.Get(q.Match(q.Index('keys_by_key'), key))
      );
      
      if (!result.data) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: "Anahtar bulunamadı" })
        };
      }
      
      const now = new Date();
      const expiresAt = new Date(result.data.expiresAt);
      const isValid = expiresAt > now;
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          valid: isValid,
          name: result.data.name,
          createdAt: result.data.createdAt,
          expiresAt: result.data.expiresAt,
          timeLeft: isValid ? Math.floor((expiresAt - now) / (1000 * 60 * 60)) : 0
        })
      };
    }
    
    // Tüm anahtarları getir
    if (action === 'get_keys') {
      const result = await client.query(
        q.Map(
          q.Paginate(q.Documents(q.Collection('keys'))),
          q.Lambda(x => q.Get(x))
        )
      );
      
      const keys = result.data.map(item => ({
        key: item.data.key,
        name: item.data.name,
        createdAt: item.data.createdAt,
        expiresAt: item.data.expiresAt,
        active: item.data.active
      }));
      
      return {
        statusCode: 200,
        body: JSON.stringify({ keys })
      };
    }
    
    // Anahtar sil
    if (action === 'delete_key') {
      const key = data.key;
      
      // Önce anahtarın referansını bul
      const found = await client.query(
        q.Get(q.Match(q.Index('keys_by_key'), key))
      );
      
      // Sonra sil
      await client.query(
        q.Delete(found.ref)
      );
      
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true })
      };
    }
    
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Geçersiz işlem" })
    };
    
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};