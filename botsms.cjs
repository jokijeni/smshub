const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

const url = "https://smshub.org/stubs/handler_api.php?";
const botToken = "xxxx"; // Ganti bot token dari botfather sob
const bot = new TelegramBot(botToken, { polling: true });

let usersData = {}; // save  data per pengguna

// Mengecek validitas API Key
async function validateApiKey(chatId) {
  try {
    const { api_key } = usersData[chatId];
    const response = await axios.get(url + `api_key=${api_key}&action=getBalance&currency=840`);
    if (response.data) {
      usersData[chatId].isApiKeyValid = true;
      bot.sendMessage(chatId, "API key valid. Menu utama akan ditampilkan.");
      showMenu(chatId);
    } else {
      bot.sendMessage(chatId, "API key tidak valid. Silakan coba lagi.");
    }
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, "Terjadi kesalahan saat memvalidasi API key.");
  }
}

// Mendapatkan saldo
async function getBalance(chatId) {
  try {
    const { api_key, isApiKeyValid } = usersData[chatId];
    if (!isApiKeyValid) {
      bot.sendMessage(chatId, "API key belum valid. Silakan masukkan API key terlebih dahulu.");
      return;
    }
    const response = await axios.get(url + `api_key=${api_key}&action=getBalance&currency=840`);
    bot.sendMessage(chatId, "Saldo Anda: " + response.data);
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, "Terjadi kesalahan saat mendapatkan saldo.");
  }
}

// Membeli nomor dengan parameter yang dapat dikonfigurasi
async function getNumber(chatId) {
  try {
    const { api_key, isApiKeyValid, operator, country, maxPrice } = usersData[chatId];
    if (!isApiKeyValid) {
      bot.sendMessage(chatId, "API key belum valid. Silakan masukkan API key terlebih dahulu.");
      return;
    }
    const response = await axios.get(
      url + `api_key=${api_key}&action=getNumber&service=tg&operator=${operator}&country=${country}&maxPrice=${maxPrice}&currency=840`
    );

    if (response.data.startsWith("ACCESS_NUMBER")) {
      const [access, id, number] = response.data.split(":");
      usersData[chatId].currentId = id;
      usersData[chatId].currentNumber = number;
      bot.sendMessage(chatId, `Nomor berhasil dibeli: ${number} (ID: ${id})`);
      await getBalance(chatId);
      showMenu(chatId);
    } else {
      bot.sendMessage(chatId, "Gagal membeli nomor: " + response.data);
      showMenu(chatId);
    }
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, "Terjadi kesalahan saat membeli nomor.");
  }
}

// Cek OTP
async function checkOtp(chatId) {
  try {
    const { api_key, isApiKeyValid, currentId } = usersData[chatId];
    if (!isApiKeyValid) {
      bot.sendMessage(chatId, "API key belum valid. Silakan masukkan API key terlebih dahulu.");
      return;
    }
    if (!currentId) {
      bot.sendMessage(chatId, "Tidak ada ID aktivasi yang tersedia.");
      return showMenu(chatId);
    }
    const response = await axios.get(url + `api_key=${api_key}&action=getStatus&id=${currentId}`);
    bot.sendMessage(chatId, "Status OTP: " + response.data);
    showMenu(chatId);
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, "Terjadi kesalahan saat mengecek OTP.");
  }
}

// Set status untuk menghapus nomor
async function setStatus(chatId) {
  try {
    const { api_key, isApiKeyValid, currentId } = usersData[chatId];
    if (!isApiKeyValid) {
      bot.sendMessage(chatId, "API key belum valid. Silakan masukkan API key terlebih dahulu.");
      return;
    }
    if (!currentId) {
      bot.sendMessage(chatId, "Tidak ada ID aktivasi yang tersedia.");
      return showMenu(chatId);
    }
    const response = await axios.get(url + `api_key=${api_key}&action=setStatus&status=8&id=${currentId}`);
    bot.sendMessage(chatId, "Nomor berhasil dihapus: " + response.data);
    usersData[chatId].currentId = null;
    usersData[chatId].currentNumber = null;
    await getBalance(chatId);
    showMenu(chatId);
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, "Terjadi kesalahan saat menghapus nomor.");
  }
}

// Menampilkan menu utama
function showMenu(chatId) {
  bot.sendMessage(
    chatId,
    "=== Menu ===\n1. Beli Nomor\n2. Cek OTP\n3. Set Status (Hapus Nomor)\n4. Edit Parameter\n5. Ubah API Key\n6. Keluar",
    {
      reply_markup: {
        keyboard: [["1. Beli Nomor", "2. Cek OTP"], ["3. Set Status", "4. Edit Parameter"], ["5. Ubah API Key", "6. Keluar"]],
        one_time_keyboard: true,
      },
    }
  );
}

// Menampilkan menu untuk mengedit parameter
function showEditMenu(chatId) {
  bot.sendMessage(
    chatId,
    "=== Edit Parameter ===\n1. Edit Operator\n2. Edit Country\n3. Edit Max Price\n4. Kembali ke Menu Utama",
    {
      reply_markup: {
        keyboard: [["1. Edit Operator", "2. Edit Country"], ["3. Edit Max Price", "4. Kembali ke Menu Utama"]],
        one_time_keyboard: true,
      },
    }
  );
}

// Mengatur parameter berdasarkan input
function setParameter(chatId, parameter, value) {
  switch (parameter) {
    case "operator":
      usersData[chatId].operator = value;
      bot.sendMessage(chatId, `Operator diubah menjadi: ${value}`);
      break;
    case "country":
      usersData[chatId].country = value;
      bot.sendMessage(chatId, `Country diubah menjadi: ${value}`);
      break;
    case "maxPrice":
      usersData[chatId].maxPrice = value;
      bot.sendMessage(chatId, `Max Price diubah menjadi: ${value}`);
      break;
    default:
      bot.sendMessage(chatId, "Parameter tidak valid.");
      break;
  }
  showMenu(chatId);
}

// Event ketika pesan diterima
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Jika pengguna belum terdaftar di usersData, daftarkan
  if (!usersData[chatId]) {
    usersData[chatId] = {
      api_key: "",
      operator: "any",
      country: "31",
      maxPrice: "0.45",
      currentId: null,
      currentNumber: null,
      isApiKeyValid: false,
    };
  }

  const { isApiKeyValid } = usersData[chatId];

  if (!isApiKeyValid && text !== "/start") {
    bot.sendMessage(chatId, "API key belum valid. Silakan masukkan API key terlebih dahulu.");
    return;
  }

  if (text === "/start") {
    bot.sendMessage(chatId, "Masukkan API key Anda:");
    bot.once("message", (msg) => {
      usersData[chatId].api_key = msg.text.trim();
      validateApiKey(chatId);
    });
    return;
  }

  if (text === "5. Ubah API Key") {
    bot.sendMessage(chatId, "Masukkan API key baru:");
    bot.once("message", (msg) => {
      usersData[chatId].api_key = msg.text.trim();
      validateApiKey(chatId);
    });
    return;
  }

  switch (text) {
    case "1. Beli Nomor":
      getNumber(chatId);
      break;
    case "2. Cek OTP":
      checkOtp(chatId);
      break;
    case "3. Set Status":
      setStatus(chatId);
      break;
    case "4. Edit Parameter":
      showEditMenu(chatId);
      break;
    case "6. Keluar":
      bot.sendMessage(chatId, "Terima kasih, sampai jumpa.");
      break;
    case "1. Edit Operator":
      bot.sendMessage(chatId, "Masukkan Operator baru:");
      bot.once("message", (msg) => {
        setParameter(chatId, "operator", msg.text.trim());
      });
      break;
    case "2. Edit Country":
      bot.sendMessage(chatId, "Masukkan Country baru:");
      bot.once("message", (msg) => {
        setParameter(chatId, "country", msg.text.trim());
      });
      break;
    case "3. Edit Max Price":
      bot.sendMessage(chatId, "Masukkan Max Price baru:");
      bot.once("message", (msg) => {
        setParameter(chatId, "maxPrice", msg.text.trim());
      });
      break;
    case "4. Kembali ke Menu Utama":
      showMenu(chatId);
      break;
    default:
      bot.sendMessage(chatId, "Pilihan tidak dikenali. Silakan pilih dari menu.");
      showMenu(chatId);
      break;
  }
});
