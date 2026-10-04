self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("dish-images"))
            .map((key) => caches.delete(key)),
        ),
      ),
  );
});
