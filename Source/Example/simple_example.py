import mne
import numpy as np
import matplotlib.pyplot as plt

# Путь к файлу с данными
file_path = "/Users/niko_zvt/Repos/Bloom/eeg-analyzer/Data/10 Hamo Juan(1)_2026-04-16_13-54-30.bdf"

# Загружаем данные
raw = mne.io.read_raw_bdf(file_path)

# Рисуем данные
raw.plot()
plt.show()

# Вырезаем данные в окне 5 минут
data = raw.copy().crop(tmin=0.0, tmax=300.0)

# Создаем эпохи по 10 секунд
epoch_time = 10.0
epochs = mne.make_fixed_length_epochs(raw=data, duration=epoch_time)

# Получаем список каналов
channels = epochs.info["ch_names"]
print(channels)

# Берем эпоху 2
epoch = epochs[2].load_data().pick(["C3-A1", "C4-A2"])

# Спектральный анализ
alpha_frequencies = {"min": 8, "max": 13}
psd = epoch.compute_psd(fmin=alpha_frequencies["min"], fmax=alpha_frequencies["max"])

# Рисуем спектральный анализ
psd.plot(average=True)
plt.show()

# Получаем таблицу с данными и переводим в дБ
psd_dB = 10 * np.log10(psd.get_data())
print(psd_dB)

# Средняя мощность по каждому каналу в альфа-диапазоне
avg_psd_dB = psd_dB.mean(axis=2)
print(f"Средняя мощность по каждому каналу в альфа-диапазоне: {avg_psd_dB}")
print(f"Средняя мощность по двум каналам в альфа-диапазоне: {avg_psd_dB.mean()}")

# Можно получать данные через метки
# epoch_by_event = mne.Epochs(raw, events, tmin=-epoch_time/2, tmax=epoch_time/2)