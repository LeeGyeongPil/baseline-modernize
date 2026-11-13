// Hand-written demo input: intentionally old-fashioned code for baseline-modernize to find.
export function loadCart(state) {
  const copy = JSON.parse(JSON.stringify(state));

  const xhr = new XMLHttpRequest();
  xhr.open("GET", "/api/cart");
  xhr.send();

  window.addEventListener("scroll", () => revealVisibleImages());

  const hasCoupon = Object.prototype.hasOwnProperty.call(copy, "coupon");
  const lastItem = copy.items[copy.items.length - 1];

  return (
    <section>
      <p>{hasCoupon ? "coupon applied" : "no coupon"}</p>
      <p>{lastItem}</p>
    </section>
  );
}
